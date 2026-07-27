import { describe, it, expect, beforeEach } from 'vitest';
import { useFileStore } from '../../stores/file-store';

describe('File Store', () => {
  beforeEach(() => {
    useFileStore.getState().clearFiles();
  });

  it('should have empty initial state', () => {
    const state = useFileStore.getState();
    expect(state.files).toHaveLength(0);
    expect(state.isUploading).toBe(false);
    expect(state.uploadProgress).toBe(0);
  });

  it('should add file to list', () => {
    const store = useFileStore.getState();

    store.addFile({
      id: 'uuid-1',
      name: 'tender.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      category: 'tender',
      status: 'uploading',
      createdAt: new Date().toISOString(),
    });

    expect(useFileStore.getState().files).toHaveLength(1);
    expect(useFileStore.getState().files[0].name).toBe('tender.pdf');
  });

  it('should add multiple files', () => {
    const store = useFileStore.getState();

    store.addFile({
      id: 'uuid-1',
      name: 'tender1.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      category: 'tender',
      status: 'ready',
      createdAt: new Date().toISOString(),
    });

    store.addFile({
      id: 'uuid-2',
      name: 'tender2.pdf',
      size: 2048,
      mimeType: 'application/pdf',
      category: 'tender',
      status: 'ready',
      createdAt: new Date().toISOString(),
    });

    expect(useFileStore.getState().files).toHaveLength(2);
  });

  it('should update file status', () => {
    const store = useFileStore.getState();

    store.addFile({
      id: 'uuid-1',
      name: 'tender.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      category: 'tender',
      status: 'uploading',
      createdAt: new Date().toISOString(),
    });

    store.updateFileStatus('uuid-1', 'ready');

    expect(useFileStore.getState().files[0].status).toBe('ready');
  });

  it('should remove file from list', () => {
    const store = useFileStore.getState();

    store.addFile({
      id: 'uuid-1',
      name: 'tender.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      category: 'tender',
      status: 'ready',
      createdAt: new Date().toISOString(),
    });

    store.removeFile('uuid-1');

    expect(useFileStore.getState().files).toHaveLength(0);
  });

  it('should clear all files', () => {
    const store = useFileStore.getState();

    store.addFile({
      id: 'uuid-1',
      name: 'tender1.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      category: 'tender',
      status: 'ready',
      createdAt: new Date().toISOString(),
    });

    store.addFile({
      id: 'uuid-2',
      name: 'tender2.pdf',
      size: 2048,
      mimeType: 'application/pdf',
      category: 'tender',
      status: 'ready',
      createdAt: new Date().toISOString(),
    });

    store.clearFiles();

    expect(useFileStore.getState().files).toHaveLength(0);
  });

  it('should set uploading state', () => {
    const store = useFileStore.getState();
    store.setUploading(true);
    expect(useFileStore.getState().isUploading).toBe(true);
  });

  it('should set upload progress', () => {
    const store = useFileStore.getState();
    store.setUploading(true, 50);
    expect(useFileStore.getState().uploadProgress).toBe(50);
  });

  it('should find file by id', () => {
    const store = useFileStore.getState();

    store.addFile({
      id: 'uuid-1',
      name: 'tender.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      category: 'tender',
      status: 'ready',
      createdAt: new Date().toISOString(),
    });

    const file = useFileStore.getState().files.find(f => f.id === 'uuid-1');

    expect(file).toBeDefined();
    expect(file?.name).toBe('tender.pdf');
  });

  it('should not update non-existent file', () => {
    const store = useFileStore.getState();

    store.addFile({
      id: 'uuid-1',
      name: 'tender.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      category: 'tender',
      status: 'ready',
      createdAt: new Date().toISOString(),
    });

    store.updateFileStatus('non-existent-id', 'ready');

    expect(useFileStore.getState().files[0].status).toBe('ready');
  });
});
