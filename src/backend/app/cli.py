from __future__ import annotations

import argparse
import asyncio
import json
import mimetypes
import os
import sys
import time
import webbrowser
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

from app.config import get_settings
from app.infrastructure.llm.lite_llm import LiteLLMService
from app.services.extract_service import (
    _elements_from_plain_text,
    _normalize_elements,
    _parse_llm_json_response,
    extract_text_from_content,
)
from app.services.prompt_builder import get_prompt_builder


APP_NAME = "Bid Master CLI"
MAX_CHARS = 200000
DEFAULT_API_URL = "https://bidmaster.asia"
CREDENTIALS_PATH = Path.home() / ".bid-master" / "credentials.json"
SUPPORTED_FILE_SUFFIXES = {".pdf", ".doc", ".docx", ".md", ".txt", ".xlsx", ".xls", ".csv"}
QUOTE_FILE_SUFFIXES = {".xlsx", ".xls", ".csv"}


class CliError(Exception):
    pass


def normalize_argv(argv: list[str]) -> list[str]:
    commands = {"auth", "tools", "extract", "analyze", "quote", "simulate"}
    if not argv or argv[0] in commands or argv[0] in {"-h", "--help", "-v", "--version"}:
        return argv
    return ["run", *argv]


class BidMasterArgumentParser(argparse.ArgumentParser):
    def format_help(self) -> str:
        help_text = super().format_help()
        help_text = help_text.replace("{run,auth,tools,extract,analyze,quote,simulate}", "{auth,tools,extract,analyze,quote,simulate}")
        help_text = help_text.replace("    run                 ==SUPPRESS==\n", "")
        help_text = help_text.replace(
            "usage: bidmaster [-h] [-v] {run,auth,tools,extract,analyze,quote,simulate} ...",
            "usage: bidmaster [-h] [-v] <文件或目录> [选项]\n       bidmaster auth [login|status|logout]\n       bidmaster tools [list|info]\n       bidmaster extract|analyze|quote|simulate <文件> [选项]",
        )
        return help_text


def main() -> None:
    load_dotenv()
    argv = normalize_argv(sys.argv[1:])
    parser = build_parser()
    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return

    try:
        asyncio.run(run_command(args))
    except CliError as error:
        print_error(str(error))
        raise SystemExit(1) from error
    except KeyboardInterrupt:
        print("\n已取消")
        raise SystemExit(130)


def build_parser() -> argparse.ArgumentParser:
    parser = BidMasterArgumentParser(
        prog="bidmaster",
        description="招投标智能分析工具箱 CLI。默认用法：bidmaster <文件或目录>，自动调用网页端服务生成分析结果。",
        epilog=(
            "示例:\n"
            "  bidmaster tender.pdf --out summary.md\n"
            "  bidmaster opening.xlsx --type quote --out quote-report.md\n"
            "  bidmaster ./docs/ --out ./results -w 2 -y\n"
            "  bidmaster auth\n"
            "  bidmaster auth status\n"
            "  bidmaster tools list\n"
            "  bidmaster simulate tender.pdf --project-name 项目名称 --project-type design\n\n"
            "主命令选项:\n"
            "  -o, --out PATH        输出文件或目录\n"
            "  -q, --ai              使用网页端 AI 增强分析模式\n"
            "  -w, --workers N       批量处理并发数\n"
            "  -y, --yes             跳过确认提示\n"
            "  --type TASK           extract、analyze 或 quote\n"
            "  --format FORMAT       md 或 json\n"
            "  --local               使用本地环境执行"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("-v", "--version", action="version", version="Bid Master CLI 1.0.3")

    subparsers = parser.add_subparsers(dest="command")
    run_parser = subparsers.add_parser("run", help=argparse.SUPPRESS)
    run_parser.add_argument("input", help="输入文件或目录。PDF/DOCX/MD/TXT 默认做要素提取，XLSX/CSV 默认做开标报价分析")
    run_parser.add_argument("-o", "--out", default=None, help="输出文件或目录路径")
    run_parser.add_argument("-q", "--ai", action="store_true", help="使用网页端 AI 增强分析模式")
    run_parser.add_argument("-w", "--workers", type=int, default=1, help="批量处理并发数，默认 1")
    run_parser.add_argument("-y", "--yes", action="store_true", help="跳过需要确认的提示，适合脚本自动化")
    run_parser.add_argument("--type", choices=["extract", "analyze", "quote"], default=None, help="指定任务类型，默认按文件类型自动判断")
    run_parser.add_argument("--format", choices=["md", "json"], default="md", help="输出格式，默认 md")
    run_parser.add_argument("--provider", default=None, help="AI 供应商，默认读取网页端配置")
    run_parser.add_argument("--model", default=None, help="模型名称")
    run_parser.add_argument("--modules", default=None, help="开标分析模块，多个模块用英文逗号分隔")
    run_parser.add_argument("--local", action="store_true", help="使用本地环境执行，不调用网页端服务")

    auth_parser = subparsers.add_parser("auth", help="网页登录授权与本地凭证管理")
    auth_parser.add_argument("--api-url", default=None, help="网页端地址，默认使用线上服务")
    auth_parser.add_argument("--no-browser", action="store_true", help="只打印授权链接，不自动打开浏览器")
    auth_subparsers = auth_parser.add_subparsers(dest="auth_command")
    auth_login = auth_subparsers.add_parser("login", help="打开网页授权本机 CLI")
    auth_login.add_argument("--api-url", default=None, help="网页端地址，默认使用线上服务")
    auth_login.add_argument("--no-browser", action="store_true", help="只打印授权链接，不自动打开浏览器")
    auth_subparsers.add_parser("status", help="查看当前 CLI 登录状态")
    auth_subparsers.add_parser("logout", help="清除本地 CLI 登录凭证")

    tools_parser = subparsers.add_parser("tools", help="辅助工具命令")
    tools_subparsers = tools_parser.add_subparsers(dest="tool_command")
    tools_subparsers.add_parser("list", help="列出可用工具")
    info_parser = tools_subparsers.add_parser("info", help="查看工具说明")
    info_parser.add_argument("name", help="工具名称")

    extract_parser = subparsers.add_parser("extract", help="提取招标文件关键内容")
    add_file_options(extract_parser)
    extract_parser.add_argument("-f", "--format", choices=["md", "json"], default="md", help="输出格式，默认 md")
    extract_parser.add_argument("--provider", default=None, help="AI 供应商，默认读取网页端配置或 AI_PROVIDER")
    extract_parser.add_argument("--model", default=None, help="模型名称")
    extract_parser.add_argument("--local", action="store_true", help="使用本地环境执行，不调用网页端服务")

    analyze_parser = subparsers.add_parser("analyze", help="生成招标文件分析报告")
    add_file_options(analyze_parser)
    analyze_parser.add_argument("--provider", default=None, help="AI 供应商，默认读取 AI_PROVIDER")
    analyze_parser.add_argument("--model", default=None, help="模型名称")
    analyze_parser.add_argument("--local", action="store_true", help="使用本地环境执行，不调用网页端服务")

    simulate_parser = subparsers.add_parser("simulate", help="按网页端四步流程模拟编制招标文件")
    add_file_options(simulate_parser)
    simulate_parser.add_argument("--provider", default=None, help="AI 供应商，默认读取网页端配置")
    simulate_parser.add_argument("--model", default=None, help="模型名称")
    simulate_parser.add_argument("--project-name", default="", help="项目名称")
    simulate_parser.add_argument("--project-type", default="design", help="项目类型，默认 design")
    simulate_parser.add_argument("--project-scale", default="", help="项目规模")
    simulate_parser.add_argument("--investment-estimate", default="", help="投资估算")
    simulate_parser.add_argument("--region", default="", help="项目地区")
    simulate_parser.add_argument("--special-requirements", default="", help="特殊要求")

    quote_parser = subparsers.add_parser("quote", help="分析开标报价文件")
    add_file_options(quote_parser)
    quote_parser.add_argument("-f", "--format", choices=["md", "json"], default="md", help="输出格式，默认 md")
    quote_parser.add_argument("--modules", default=None, help="分析模块，多个模块用英文逗号分隔")
    quote_parser.add_argument("--provider", default=None, help="AI 供应商，默认读取网页端配置")
    quote_parser.add_argument("--model", default=None, help="模型名称")
    quote_parser.add_argument("--local", action="store_true", help="使用本地环境执行，不调用网页端服务")

    return parser


def add_file_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("file", help="输入文件路径")
    parser.add_argument("-o", "--out", default=None, help="输出文件路径")


def coerce_task_args(args: argparse.Namespace, task_type: str, file_path: Path | None = None, out: str | None = None) -> argparse.Namespace:
    source = str(file_path) if file_path else getattr(args, "file", None) or getattr(args, "input", None)
    return argparse.Namespace(
        file=source,
        out=out if out is not None else getattr(args, "out", None),
        format=getattr(args, "format", "md"),
        provider=getattr(args, "provider", None),
        model=getattr(args, "model", None),
        modules=getattr(args, "modules", None),
        local=getattr(args, "local", False),
        type=task_type,
    )


def infer_task_type(input_path: Path, explicit_type: str | None = None) -> str:
    if explicit_type:
        return explicit_type
    suffix = input_path.suffix.lower()
    if suffix in QUOTE_FILE_SUFFIXES:
        return "quote"
    return "extract"


def collect_input_files(input_path: Path) -> list[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.is_dir():
        raise CliError(f"输入路径不存在：{input_path}")
    files = [path for path in sorted(input_path.rglob("*")) if path.is_file() and path.suffix.lower() in SUPPORTED_FILE_SUFFIXES]
    if not files:
        raise CliError(f"目录中没有可处理文件：{input_path}")
    return files


def resolve_batch_output(out: str | None, input_root: Path, file_path: Path, task_type: str, output_format: str) -> str | None:
    if not out:
        return None
    out_path = Path(out).expanduser().resolve()
    if input_root.is_file():
        return str(out_path)
    suffix = "quote-report" if task_type == "quote" else "analysis" if task_type == "analyze" else "summary"
    return str(out_path / f"{file_path.stem}-{suffix}.{output_format}")


async def run_auto(args: argparse.Namespace) -> None:
    input_root = Path(args.input).expanduser().resolve()
    files = collect_input_files(input_root)
    if len(files) > 1 and not args.yes:
        print(f"将处理 {len(files)} 个文件，并发数：{max(args.workers, 1)}")
    workers = max(args.workers, 1)
    if workers == 1:
        for file_path in files:
            await run_auto_file(args, input_root, file_path)
        return
    semaphore = asyncio.Semaphore(workers)
    async def _run(file_path: Path) -> None:
        async with semaphore:
            await run_auto_file(args, input_root, file_path)
    await asyncio.gather(*[_run(file_path) for file_path in files])


async def run_auto_file(args: argparse.Namespace, input_root: Path, file_path: Path) -> None:
    task_type = infer_task_type(file_path, args.type)
    output_format = args.format
    out = resolve_batch_output(args.out, input_root, file_path, task_type, output_format)
    task_args = coerce_task_args(args, task_type, file_path, out)
    if task_type == "quote":
        if args.local:
            run_quote(task_args)
        else:
            await run_remote_quote(task_args)
    elif task_type == "analyze":
        if args.local:
            await run_analyze(task_args)
        else:
            await run_remote_analyze(task_args)
    else:
        if args.local:
            await run_extract(task_args)
        else:
            await run_remote_extract(task_args)


def run_tools(args: argparse.Namespace) -> None:
    tools = {
        "extract": "招标文件关键内容提取：bidmaster extract tender.pdf --out summary.md",
        "analyze": "招标文件风险分析：bidmaster analyze tender.pdf --out analysis.md",
        "quote": "开标报价分析：bidmaster quote opening.xlsx --out quote-report.md",
        "simulate": "模拟编制：bidmaster simulate tender.pdf --project-name 项目名称",
    }
    if args.tool_command == "list":
        for name, description in tools.items():
            print(f"{name}\t{description}")
        return
    if args.tool_command == "info":
        description = tools.get(args.name)
        if not description:
            raise CliError(f"未知工具：{args.name}")
        print(description)
        return
    raise CliError("请指定 tools 子命令：list 或 info")


async def run_command(args: argparse.Namespace) -> None:
    if args.command == "auth":
        await run_auth(args)
    elif args.command == "tools":
        run_tools(args)
    elif args.command == "extract":
        if args.local:
            await run_extract(args)
        else:
            await run_remote_extract(args)
    elif args.command == "analyze":
        if args.local:
            await run_analyze(args)
        else:
            await run_remote_analyze(args)
    elif args.command == "quote":
        if args.local:
            run_quote(args)
        else:
            await run_remote_quote(args)
    elif args.command == "simulate":
        await run_remote_simulate(args)
    elif args.command == "run" or args.input:
        await run_auto(args)
    else:
        raise CliError(f"未知命令：{args.command}")


async def run_auth(args: argparse.Namespace) -> None:
    if args.auth_command in {None, "login"}:
        await run_auth_login(args)
    elif args.auth_command == "status":
        await run_auth_status()
    elif args.auth_command == "logout":
        run_auth_logout()
    else:
        raise CliError("请指定 auth 子命令：login、status 或 logout")


async def run_auth_login(args: argparse.Namespace) -> None:
    api_url = normalize_api_url(args.api_url)
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            start_res = await client.post(f"{api_url}/api/cli-auth/start")
        except httpx.HTTPError as error:
            raise CliError(f"无法连接网页端服务：{error}") from error
    if start_res.status_code != 200:
        raise CliError(f"创建 CLI 授权请求失败：HTTP {start_res.status_code} {start_res.text}")

    data = start_res.json()
    verification_uri = data["verification_uri"]
    device_code = data["device_code"]
    interval = int(data.get("interval") or 2)
    expires_in = int(data.get("expires_in") or 600)

    print("请在浏览器中授权 Bid Master CLI：", flush=True)
    print(verification_uri, flush=True)
    print(flush=True)
    if not args.no_browser:
        webbrowser.open(verification_uri)
    print("等待网页端授权...", flush=True)

    deadline = time.monotonic() + expires_in
    async with httpx.AsyncClient(timeout=15) as client:
        while time.monotonic() < deadline:
            await asyncio.sleep(interval)
            try:
                poll_res = await client.post(
                    f"{api_url}/api/cli-auth/poll",
                    json={"device_code": device_code},
                )
            except httpx.HTTPError as error:
                raise CliError(f"轮询授权状态失败：{error}") from error

            if poll_res.status_code != 200:
                raise CliError(f"轮询授权状态失败：HTTP {poll_res.status_code} {poll_res.text}")
            payload = poll_res.json()
            status = payload.get("status")
            if status == "pending":
                continue
            if status == "expired":
                raise CliError("授权请求已过期，请重新执行 bidmaster auth login")
            if payload.get("access_token"):
                save_credentials({
                    "api_url": api_url,
                    "access_token": payload["access_token"],
                    "user": payload.get("user") or {},
                    "token_type": payload.get("token_type") or "bearer",
                })
                user = payload.get("user") or {}
                print(f"授权成功：{user.get('username') or user.get('email') or '当前用户'}")
                return
            raise CliError(f"授权未完成：{status or '未知状态'}")

    raise CliError("授权等待超时，请重新执行 bidmaster auth login")


async def run_auth_status() -> None:
    credentials = load_credentials()
    if not credentials:
        print("未登录。请执行：bidmaster auth login")
        return

    api_url = credentials["api_url"]
    token = credentials["access_token"]
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            res = await client.get(
                f"{api_url}/api/cli-auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
        except httpx.HTTPError as error:
            raise CliError(f"无法验证登录状态：{error}") from error
    if res.status_code == 200:
        user = res.json().get("user") or {}
        print(f"已登录：{user.get('username') or user.get('email') or user.get('id')}")
        print(f"服务地址：{api_url}")
        return
    print("本地凭证已失效，请重新执行：bidmaster auth login")


def run_auth_logout() -> None:
    if CREDENTIALS_PATH.exists():
        CREDENTIALS_PATH.unlink()
    print("已清除本地 CLI 登录凭证")


def normalize_api_url(api_url: str | None) -> str:
    value = api_url or os.getenv("BID_MASTER_API_URL") or DEFAULT_API_URL
    return value.rstrip("/")


def load_credentials() -> dict[str, Any] | None:
    if not CREDENTIALS_PATH.exists():
        return None
    try:
        data = json.loads(CREDENTIALS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not data.get("api_url") or not data.get("access_token"):
        return None
    return data


def save_credentials(credentials: dict[str, Any]) -> None:
    CREDENTIALS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CREDENTIALS_PATH.write_text(json.dumps(credentials, ensure_ascii=False, indent=2), encoding="utf-8")
    CREDENTIALS_PATH.chmod(0o600)


def get_remote_credentials() -> dict[str, Any]:
    credentials = load_credentials()
    if not credentials:
        raise CliError("未登录网页端。请先执行：bidmaster auth login")
    return credentials


def remote_headers(credentials: dict[str, Any]) -> dict[str, str]:
    token_type = credentials.get("token_type") or "bearer"
    token = credentials["access_token"]
    return {"Authorization": f"{token_type.title()} {token}"}


def guess_mime_type(input_path: Path) -> str:
    mime_type, _ = mimetypes.guess_type(input_path.name)
    return mime_type or "application/octet-stream"


async def upload_remote_file(client: httpx.AsyncClient, credentials: dict[str, Any], input_path: Path, category: str) -> str:
    print_step(1, 4, "正在上传文件到网页端...")
    with input_path.open("rb") as file_obj:
        response = await client.post(
            f"{credentials['api_url']}/api/files/upload",
            headers=remote_headers(credentials),
            files={"file": (input_path.name, file_obj, guess_mime_type(input_path))},
            params={"category": category},
        )
    if response.status_code == 401:
        raise CliError("网页端登录凭证已失效，请重新执行：bidmaster auth login")
    if response.status_code != 200:
        raise CliError(f"上传文件失败：HTTP {response.status_code} {response.text}")
    payload = response.json()
    file_id = (payload.get("data") or {}).get("id")
    if not file_id:
        raise CliError("网页端未返回文件 ID")
    return file_id


def parse_sse_line(line: str) -> dict[str, Any] | None:
    if not line.startswith("data: "):
        return None
    try:
        return json.loads(line[6:])
    except json.JSONDecodeError:
        return None


async def iter_sse_events(response: httpx.Response):
    async for line in response.aiter_lines():
        event = parse_sse_line(line)
        if event is not None:
            yield event


async def run_remote_extract(args: argparse.Namespace) -> None:
    credentials = get_remote_credentials()
    input_path = resolve_input_file(args.file)
    output_path = resolve_output_file(args.out, input_path, "summary", args.format)
    print_header(input_path, "网页端招标文件关键内容提取", output_path)

    async with httpx.AsyncClient(timeout=None) as client:
        file_id = await upload_remote_file(client, credentials, input_path, "tender")
        elements = await request_remote_extract(client, credentials, file_id, args.provider, args.model)

    print_step(4, 4, "正在写入结果文件...")
    if args.format == "json":
        output = json.dumps({"elements": elements}, ensure_ascii=False, indent=2)
    else:
        output = render_extract_markdown(input_path, elements)
    write_output(output_path, output)
    print("\n提取完成\n")
    print_extract_summary(elements)
    print(f"\n结果已保存：{output_path}")


async def request_remote_extract(
    client: httpx.AsyncClient,
    credentials: dict[str, Any],
    file_id: str,
    provider: str | None,
    model: str | None,
) -> list[dict[str, Any]]:
    print_step(2, 4, "正在请求网页端开始提取...")
    payload = {"fileId": file_id, "provider": provider or "deepseek", "model": model}
    async with client.stream(
        "POST",
        f"{credentials['api_url']}/api/extract/element",
        headers={**remote_headers(credentials), "Content-Type": "application/json"},
        json=payload,
    ) as response:
        if response.status_code == 401:
            raise CliError("网页端登录凭证已失效，请重新执行：bidmaster auth login")
        if response.status_code != 200:
            body = await response.aread()
            raise CliError(f"提取请求失败：HTTP {response.status_code} {body.decode('utf-8', errors='ignore')}")
        print_step(3, 4, "网页端 AI 正在提取...")
        elements: list[dict[str, Any]] = []
        raw_contents: list[str] = []
        last_message = ""
        async for event in iter_sse_events(response):
            event_type = event.get("type")
            if event_type in {"progress", "llm_progress"} and event.get("message"):
                message = str(event["message"])
                if message != last_message:
                    print(message)
                    last_message = message
            elif event_type == "element":
                raw = event.get("data") or event
                elements.extend(normalize_remote_element(raw))
                if isinstance(raw, dict) and raw.get("content"):
                    raw_contents.append(str(raw["content"]))
            elif event_type == "error":
                data = event.get("data") or {}
                raise CliError(data.get("message") or event.get("message") or "网页端提取失败")
            elif event_type == "done":
                break
    if len(elements) <= 1 and raw_contents:
        fallback_elements = _elements_from_plain_text("\n\n".join(raw_contents))
        if len(fallback_elements) > len(elements):
            return fallback_elements
    return elements


def normalize_remote_element(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, dict):
        return []
    content = str(raw.get("content") or "").strip()
    nested_elements = raw.get("elements")
    if isinstance(nested_elements, list):
        return normalize_element_list(nested_elements)
    if content:
        try:
            _, parsed_elements = _parse_llm_json_response(content)
        except json.JSONDecodeError:
            parsed_elements = []
        normalized = normalize_element_list(parsed_elements)
        if normalized:
            return normalized
    name = str(raw.get("name") or "分析结果").strip()
    return [{"name": name, "content": content}]


def normalize_element_list(elements: list[Any]) -> list[dict[str, str]]:
    normalized = []
    for element in elements:
        if not isinstance(element, dict):
            continue
        name = str(element.get("name") or "分析结果").strip()
        content = str(element.get("content") or "").strip()
        if content:
            normalized.append({"name": name, "content": content})
    return normalized


async def run_remote_analyze(args: argparse.Namespace) -> None:
    credentials = get_remote_credentials()
    input_path = resolve_input_file(args.file)
    output_path = resolve_output_file(args.out, input_path, "analysis", "md")
    print_header(input_path, "网页端招标文件智能分析", output_path)

    async with httpx.AsyncClient(timeout=None) as client:
        file_id = await upload_remote_file(client, credentials, input_path, "tender")
        elements = await request_remote_extract(client, credentials, file_id, args.provider, args.model)

    report = render_remote_analyze_markdown(input_path, elements)
    write_output(output_path, report)
    print("\n分析完成\n")
    print_analysis_summary(report)
    print(f"\n结果已保存：{output_path}")


def render_remote_analyze_markdown(input_path: Path, elements: list[dict[str, Any]]) -> str:
    lines = [
        f"# {input_path.stem} 招标文件分析报告",
        "",
        f"- 来源文件：{input_path.name}",
        f"- 识别要素：{len(elements)} 项",
        "",
        "## 关键要素",
        "",
    ]
    for element in elements:
        name = str(element.get("name") or "分析结果").strip()
        content = str(element.get("content") or "未识别").strip()
        lines.extend([f"### {name}", "", content, ""])
    lines.extend([
        "## 投标响应建议",
        "",
        "请结合以上关键要素，重点核对资格条件、评分办法、投标文件格式、报价要求和递交截止时间。",
    ])
    return "\n".join(lines).rstrip() + "\n"


async def run_remote_simulate(args: argparse.Namespace) -> None:
    credentials = get_remote_credentials()
    input_path = resolve_input_file(args.file)
    output_path = resolve_output_file(args.out, input_path, "simulate-result", "md")
    print_header(input_path, "网页端模拟编制", output_path)

    async with httpx.AsyncClient(timeout=None) as client:
        file_id = await upload_remote_file(client, credentials, input_path, "tender")

        print_step(2, 6, "正在创建网页端模拟编制任务...")
        create_response = await client.post(
            f"{credentials['api_url']}/api/simulate/create",
            headers={**remote_headers(credentials), "Content-Type": "application/json"},
            json={"file_ids": [file_id]},
        )
        if create_response.status_code == 401:
            raise CliError("网页端登录凭证已失效，请重新执行：bidmaster auth login")
        if create_response.status_code != 200:
            raise CliError(f"创建模拟编制任务失败：HTTP {create_response.status_code} {create_response.text}")
        task_id = (create_response.json().get("data") or {}).get("taskId")
        if not task_id:
            raise CliError("网页端未返回模拟编制任务 ID")

        print_step(3, 6, "正在执行 PDF 转换...")
        step1 = await client.post(f"{credentials['api_url']}/api/simulate/{task_id}/step/1", headers=remote_headers(credentials))
        if step1.status_code != 200:
            raise CliError(f"PDF 转换失败：HTTP {step1.status_code} {step1.text}")
        step1_result = ((step1.json().get("data") or {}).get("step1Result") or "").strip()

        print_step(4, 6, "正在执行要素提取...")
        step2_result = await request_simulate_step(client, credentials, task_id, 2, {"provider": args.provider or "deepseek", "model": args.model})

        print_step(5, 6, "正在执行对比分析...")
        step3_result = await request_simulate_step(client, credentials, task_id, 3, {"provider": args.provider or "deepseek", "model": args.model})

        print_step(6, 6, "正在生成模拟编制结果...")
        step4_payload = {
            "provider": args.provider or "deepseek",
            "model": args.model,
            "project_name": args.project_name or input_path.stem,
            "project_type": args.project_type,
            "project_scale": args.project_scale,
            "investment_estimate": args.investment_estimate,
            "region": args.region,
            "special_requirements": args.special_requirements,
        }
        step4_result = await request_simulate_step(client, credentials, task_id, 4, step4_payload)

    output = render_simulate_markdown(input_path, step1_result, step2_result, step3_result, step4_result)
    write_output(output_path, output)
    print("\n模拟编制完成\n")
    print("输出模块：PDF转换结果、要素提取结果、对比分析结果、模拟编制结果")
    print(f"\n结果已保存：{output_path}")


async def request_simulate_step(
    client: httpx.AsyncClient,
    credentials: dict[str, Any],
    task_id: str,
    step: int,
    payload: dict[str, Any],
) -> str:
    async with client.stream(
        "POST",
        f"{credentials['api_url']}/api/simulate/{task_id}/step/{step}",
        headers={**remote_headers(credentials), "Content-Type": "application/json"},
        json=payload,
    ) as response:
        if response.status_code == 401:
            raise CliError("网页端登录凭证已失效，请重新执行：bidmaster auth login")
        if response.status_code != 200:
            body = await response.aread()
            raise CliError(f"模拟编制步骤 {step} 失败：HTTP {response.status_code} {body.decode('utf-8', errors='ignore')}")
        content_parts: list[str] = []
        done_content = ""
        last_message = ""
        async for event in iter_sse_events(response):
            event_type = event.get("type")
            if event_type in {"progress", "llm_progress"} and event.get("message"):
                message = str(event["message"])
                if message != last_message:
                    print(message)
                    last_message = message
            elif event_type == "content":
                content_parts.append(str(event.get("content") or ""))
            elif event_type == "error":
                data = event.get("data") or {}
                raise CliError(data.get("message") or event.get("message") or f"模拟编制步骤 {step} 失败")
            elif event_type == "done":
                data = event.get("data") or {}
                done_content = str(data.get("content") or "")
                break
    return (done_content or "".join(content_parts)).strip()


def render_simulate_markdown(input_path: Path, step1: str, step2: str, step3: str, step4: str) -> str:
    sections = [
        ("PDF转换结果", format_simulate_step1(step1)),
        ("要素提取结果", step2),
        ("对比分析结果", step3),
        ("模拟编制结果", step4),
    ]
    lines = [
        f"# {input_path.stem} 模拟编制结果",
        "",
        f"- 来源文件：{input_path.name}",
        "- 网页端流程：PDF转换 → 要素提取 → 对比分析 → 模拟编制",
        "",
    ]
    for title, content in sections:
        lines.extend([f"## {title}", "", content.strip() or "未生成", ""])
    return "\n".join(lines).rstrip() + "\n"


def format_simulate_step1(step1: str) -> str:
    try:
        data = json.loads(step1)
    except json.JSONDecodeError:
        return step1
    converted = data.get("converted") or []
    failed = data.get("failed") or []
    lines = [f"- 转换成功：{len(converted)} 个文件", f"- 转换失败：{len(failed)} 个文件"]
    for item in converted:
        lines.append(f"- 文件 {item.get('file_id')}：已转换，文本长度 {item.get('content_length', 0)}")
    for item in failed:
        lines.append(f"- 文件 {item.get('file_id')}：{item.get('error', '转换失败')}")
    return "\n".join(lines)


async def run_remote_quote(args: argparse.Namespace) -> None:
    credentials = get_remote_credentials()
    input_path = resolve_input_file(args.file)
    output_path = resolve_output_file(args.out, input_path, "quote-report", args.format)
    print_header(input_path, "网页端开标报价分析", output_path)

    modules = [item.strip() for item in args.modules.split(",") if item.strip()] if args.modules else None
    form_data = {}
    if modules:
        form_data["modules"] = json.dumps(modules, ensure_ascii=False)
    if args.provider:
        form_data["provider"] = args.provider
    if args.model:
        form_data["model"] = args.model

    async with httpx.AsyncClient(timeout=None) as client:
        print_step(1, 4, "正在上传报价文件到网页端...")
        with input_path.open("rb") as file_obj:
            response = await client.post(
                f"{credentials['api_url']}/api/statistics/analyze/upload",
                headers=remote_headers(credentials),
                files={"file": (input_path.name, file_obj, guess_mime_type(input_path))},
                data={"modules": form_data.get("modules", "")},
            )
        if response.status_code == 401:
            raise CliError("网页端登录凭证已失效，请重新执行：bidmaster auth login")
        if response.status_code != 200:
            raise CliError(f"报价分析失败：HTTP {response.status_code} {response.text}")
        payload = response.json()
        if not payload.get("success"):
            raise CliError(payload.get("detail") or payload.get("error") or "报价分析失败")
        result = payload.get("data") or {}

        print_step(2, 4, "正在启动网页端 AI 综合分析...")
        task_id = None
        with input_path.open("rb") as file_obj:
            ai_response = await client.post(
                f"{credentials['api_url']}/api/statistics/analyze/comprehensive/upload/start",
                headers=remote_headers(credentials),
                files={"file": (input_path.name, file_obj, guess_mime_type(input_path))},
                data=form_data,
            )
        if ai_response.status_code == 200:
            task_id = ai_response.json().get("task_id")
        else:
            print(f"AI 综合分析启动失败，已保留基础报价分析：HTTP {ai_response.status_code}")

        ai_analysis = ""
        if task_id:
            print_step(3, 4, "正在等待网页端 AI 综合分析完成...")
            ai_analysis = await poll_remote_opening_task(client, credentials, task_id)
        else:
            print_step(3, 4, "跳过 AI 综合分析...")

    print_step(4, 4, "正在写入结果文件...")
    result_with_ai = {**result, "ai_analysis": ai_analysis}
    if args.format == "json":
        output = json.dumps(result_with_ai, ensure_ascii=False, indent=2)
    else:
        output = render_remote_quote_markdown(result_with_ai)
    write_output(output_path, output)
    print("\n分析完成\n")
    print_quote_summary(result)
    print(f"\n结果已保存：{output_path}")


async def poll_remote_opening_task(client: httpx.AsyncClient, credentials: dict[str, Any], task_id: str) -> str:
    deadline = time.monotonic() + 600
    while time.monotonic() < deadline:
        response = await client.get(
            f"{credentials['api_url']}/api/statistics/analysis-task/{task_id}",
            headers=remote_headers(credentials),
        )
        if response.status_code == 401:
            raise CliError("网页端登录凭证已失效，请重新执行：bidmaster auth login")
        if response.status_code != 200:
            raise CliError(f"获取 AI 分析任务失败：HTTP {response.status_code} {response.text}")
        record = (response.json().get("data") or {})
        status = record.get("status")
        if status in {"completed", "partial"}:
            return record.get("ai_analysis") or ""
        if status == "error":
            return record.get("ai_analysis") or ""
        await asyncio.sleep(2)
    raise CliError("AI 综合分析等待超时，请稍后在网页端查看结果")


def render_remote_quote_markdown(result: dict[str, Any]) -> str:
    from app.api.statistics import _fallback_opening_analysis

    base_report = _fallback_opening_analysis(result).rstrip()
    ai_analysis = str(result.get("ai_analysis") or "").strip()
    if not ai_analysis:
        return base_report + "\n"
    return "\n\n".join([base_report, "## 九、AI 综合分析", ai_analysis]).rstrip() + "\n"


async def run_extract(args: argparse.Namespace) -> None:
    input_path = resolve_input_file(args.file)
    output_path = resolve_output_file(args.out, input_path, "summary", args.format)
    provider = resolve_provider(args.provider)

    print_header(input_path, "招标文件关键内容提取", output_path)
    print_step(1, 4, "正在读取文件...")
    content = input_path.read_bytes()

    print_step(2, 4, "正在解析招标文件内容...")
    text_content = extract_document_text(content)

    print_step(3, 4, "正在提取项目关键信息...")
    elements = await extract_elements(text_content, provider, args.model)

    print_step(4, 4, "正在写入结果文件...")
    if args.format == "json":
        output = json.dumps({"elements": elements}, ensure_ascii=False, indent=2)
    else:
        output = render_extract_markdown(input_path, elements)
    write_output(output_path, output)

    print("\n提取完成\n")
    print_extract_summary(elements)
    print(f"\n结果已保存：{output_path}")


async def run_analyze(args: argparse.Namespace) -> None:
    input_path = resolve_input_file(args.file)
    output_path = resolve_output_file(args.out, input_path, "analysis", "md")
    provider = resolve_provider(args.provider)

    print_header(input_path, "招标文件智能分析", output_path)
    print_step(1, 5, "正在读取文件...")
    content = input_path.read_bytes()

    print_step(2, 5, "正在解析文档结构...")
    text_content = extract_document_text(content)

    print_step(3, 5, "正在提取评分规则与资格条件...")
    truncated = truncate_text(text_content)

    print_step(4, 5, "正在识别投标风险...")
    report = await analyze_document(truncated, provider, args.model)

    print_step(5, 5, "正在生成分析报告...")
    write_output(output_path, report)

    print("\n分析完成\n")
    print_analysis_summary(report)
    print(f"\n结果已保存：{output_path}")


def run_quote(args: argparse.Namespace) -> None:
    from app.api.statistics import compute_all_dimensions, parse_opening_excel, _fallback_opening_analysis

    input_path = resolve_input_file(args.file)
    output_format = args.format
    output_path = resolve_output_file(args.out, input_path, "quote-report", output_format)
    modules = [item.strip() for item in args.modules.split(",") if item.strip()] if args.modules else None

    print_header(input_path, "开标报价分析", output_path)
    print_step(1, 4, "正在读取报价文件...")
    content = input_path.read_bytes()

    print_step(2, 4, "正在识别供应商报价...")
    try:
        parsed = parse_opening_excel(content, input_path.name)
    except ValueError as error:
        raise CliError(str(error)) from error
    except Exception as error:
        raise CliError(f"无法解析报价文件，请确认表格包含投标人和报价列：{error}") from error

    print_step(3, 4, "正在计算报价区间...")
    result = compute_all_dimensions(parsed["bidders"], parsed["meta"], modules)

    print_step(4, 4, "正在生成报价分析报告...")
    if output_format == "json":
        output = json.dumps(result, ensure_ascii=False, indent=2)
    else:
        output = _fallback_opening_analysis(result)
    write_output(output_path, output)

    print("\n分析完成\n")
    print_quote_summary(result)
    print(f"\n结果已保存：{output_path}")


def resolve_input_file(file_path: str) -> Path:
    path = Path(file_path).expanduser().resolve()
    if not path.exists():
        raise CliError(f"无法读取文件 {file_path}\n\n可能原因：\n- 文件路径不存在\n- 当前目录不是文件所在目录\n\n你可以尝试：\n  bidmaster extract ./docs/tender.pdf --out tender-summary.md")
    if not path.is_file():
        raise CliError(f"输入路径不是文件：{file_path}")
    return path


def resolve_output_file(out: str | None, input_path: Path, suffix: str, output_format: str) -> Path:
    if out:
        return Path(out).expanduser().resolve()
    return input_path.with_name(f"{input_path.stem}-{suffix}.{output_format}").resolve()


def resolve_provider(provider: str | None) -> str:
    return provider or get_settings().ai_provider or "deepseek"


def extract_document_text(content: bytes) -> str:
    text_content, needs_ocr = extract_text_from_content(content)
    if needs_ocr:
        raise CliError("当前文件疑似扫描件 PDF，第一版 CLI 暂不支持本地 OCR。请先使用 Web 端 OCR，或上传可复制文本的 PDF/DOCX 文件。")
    if not text_content.strip():
        raise CliError("文档内容为空或无法解析，请确认文件格式为 PDF、DOCX、XLSX、CSV、Markdown 或 TXT。")
    return text_content


def truncate_text(text: str) -> str:
    if len(text) <= MAX_CHARS:
        return text
    return text[:MAX_CHARS] + f"\n\n[文档已截断，共 {len(text)} 字符]"


async def extract_elements(text_content: str, provider: str, model: str | None) -> list[dict[str, Any]]:
    builder = get_prompt_builder()
    messages = [
        {"role": "system", "content": builder.build_extract_system_prompt("brief")},
        {"role": "user", "content": builder.build_extract_user_prompt(truncate_text(text_content)) + "\n\n请只输出 JSON，不要输出 Markdown 代码块、解释文字或额外前后缀。"},
    ]
    response = await complete_text(provider, messages, model)
    try:
        _, elements = _parse_llm_json_response(response)
        return _normalize_elements(elements, response)
    except json.JSONDecodeError:
        return _elements_from_plain_text(response)


async def analyze_document(text_content: str, provider: str, model: str | None) -> str:
    messages = [
        {
            "role": "system",
            "content": "你是招投标文件分析专家。请输出面向招投标从业人员的 Markdown 报告，重点说明项目关键信息、资格条件、评分重点、投标风险和响应建议。",
        },
        {
            "role": "user",
            "content": f"请分析以下招标文件内容，并生成可直接保存的 Markdown 报告。\n\n---\n\n# 招标文件内容\n\n{text_content}",
        },
    ]
    report = await complete_text(provider, messages, model)
    if not report.strip():
        raise CliError("AI 未返回分析内容，请检查模型配置后重试。")
    return report.strip() + "\n"


async def complete_text(provider: str, messages: list[dict[str, str]], model: str | None) -> str:
    service = LiteLLMService()
    chunks: list[str] = []
    try:
        async for chunk in service.complete(provider, messages, model=model, stream=True):
            chunks.append(chunk)
    except Exception as error:
        raise CliError(f"AI 分析失败：{error}\n\n你可以尝试：\n  1. 在 .env.local 或 src/backend/.env 中配置对应供应商 API Key\n  2. 使用 --provider 指定可用供应商\n  3. 本地演示时设置 DEMO_MODE=true") from error
    return "".join(chunks).strip()


def render_extract_markdown(input_path: Path, elements: list[dict[str, Any]]) -> str:
    lines = [
        f"# {input_path.stem} 关键内容提取",
        "",
        f"- 来源文件：{input_path.name}",
        f"- 提取要素：{len(elements)} 项",
        "",
    ]
    for element in elements:
        name = str(element.get("name") or "分析结果").strip()
        content = str(element.get("content") or "未识别").strip()
        lines.extend([f"## {name}", "", content, ""])
    return "\n".join(lines).rstrip() + "\n"


def write_output(output_path: Path, content: str) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")


def print_header(input_path: Path, task_type: str, output_path: Path) -> None:
    print(APP_NAME)
    print()
    print(f"输入文件：{input_path}")
    print(f"任务类型：{task_type}")
    print(f"输出文件：{output_path}")
    print()


def print_step(current: int, total: int, message: str) -> None:
    print(f"[{current}/{total}] {message}")


def print_extract_summary(elements: list[dict[str, Any]]) -> None:
    for element in elements[:6]:
        name = str(element.get("name") or "分析结果").strip()
        content = " ".join(str(element.get("content") or "").split())
        preview = content[:80] + ("..." if len(content) > 80 else "")
        print(f"{name}：{preview or '未识别'}")


def print_analysis_summary(report: str) -> None:
    lines = [line.strip("- ").strip() for line in report.splitlines() if line.strip().startswith("-")]
    if not lines:
        print("报告已生成，可打开 Markdown 文件查看完整内容。")
        return
    print("核心结论：")
    for line in lines[:4]:
        print(f"- {line}")


def print_quote_summary(result: dict[str, Any]) -> None:
    stats = result.get("bid_stats") or {}
    ranking = result.get("bid_ranking") or []
    print(f"供应商数量：{result.get('bidder_count', 0)}")
    if stats:
        print(f"最低报价：{stats.get('min', '未识别')}")
        print(f"最高报价：{stats.get('max', '未识别')}")
        print(f"平均报价：{stats.get('mean', '未识别')}")
    if ranking:
        print("\n报价排名：")
        for item in ranking[:3]:
            print(f"{item.get('rank')}. {item.get('name')}    {item.get('price')}")


def print_error(message: str) -> None:
    print(f"错误：{message}")


if __name__ == "__main__":
    main()
