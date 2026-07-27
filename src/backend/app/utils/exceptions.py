"""
Custom exceptions for Bid Master Backend.
"""


class AppError(Exception):
    """Base application error."""

    def __init__(self, message: str, status_code: int = 500, code: str = None):
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)


class NotFoundError(AppError):
    """Resource not found."""

    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, 404, "NOT_FOUND")


class ValidationError(AppError):
    """Validation error."""

    def __init__(self, message: str = "Validation failed", details: dict = None):
        super().__init__(message, 400, "VALIDATION_ERROR")
        self.details = details


class FileTooLargeError(AppError):
    """File size exceeds limit."""

    def __init__(self, max_size: str = "50MB"):
        super().__init__(f"File size exceeds {max_size}", 413, "FILE_TOO_LARGE")


class UnsupportedFileTypeError(AppError):
    """File type not supported."""

    def __init__(self, file_type: str):
        super().__init__(
            f"File type {file_type} is not supported",
            400,
            "UNSUPPORTED_FILE_TYPE"
        )


class EncryptionError(AppError):
    """Encryption/Decryption error."""

    def __init__(self, message: str = "Encryption failed"):
        super().__init__(message, 500, "ENCRYPTION_ERROR")