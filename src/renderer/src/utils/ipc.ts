import { IpcRendererEvent } from 'electron';
import { PythonValidationResult } from '@common/types';

export const checkPython = async (): Promise<PythonValidationResult> => {
  return window.electron.ipcRenderer.invoke('PYTHON_CHECK');
};

// Optional: If you need to listen for unsolicited messages from PYTHON_CHECK_RESULT
// This is not strictly necessary if 'PYTHON_CHECK' handler in main process
// always sends a response back to its invoker, and also separately via webContents.send.
// The 'invoke' pattern already handles the direct response.
// However, if there are scenarios where PYTHON_CHECK_RESULT is emitted
// without a direct invoke, this listener would be useful.
export const onPythonCheckResult = (listener: (result: PythonValidationResult) => void): (() => void) => {
  const handler = (_event: IpcRendererEvent, result: PythonValidationResult) => listener(result);
  window.electron.ipcRenderer.on('PYTHON_CHECK_RESULT', handler);
  return () => window.electron.ipcRenderer.removeListener('PYTHON_CHECK_RESULT', handler);
};
