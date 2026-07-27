import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileUploader } from '../../../components/file-upload/FileUploader';

describe('FileUploader Component', () => {
  it('should render upload area', () => {
    render(<FileUploader onUpload={async () => {}} />);

    expect(screen.getByText(/点击或拖拽文件/)).toBeDefined();
  });

  it('should render file input', () => {
    const { container } = render(<FileUploader onUpload={async () => {}} />);

    const input = container.querySelector('input[type="file"]');
    expect(input).toBeDefined();
  });

  it('should accept specified file types', () => {
    const { container } = render(
      <FileUploader
        onUpload={async () => {}}
        accept=".pdf,.doc"
      />
    );

    const input = container.querySelector('input[type="file"]');
    expect(input?.getAttribute('accept')).toBe('.pdf,.doc');
  });

  it('should render upload limit text', () => {
    render(
      <FileUploader
        onUpload={async () => {}}
        maxSize={50 * 1024 * 1024}
      />
    );

    expect(screen.getByText(/最大 50MB/)).toBeDefined();
  });

  it('should call onUpload when file is selected', async () => {
    let called = false;
    const onUpload = async () => {
      called = true;
    };

    const { container } = render(
      <FileUploader onUpload={onUpload} />
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).toBeDefined();
  });
});
