import { test, expect, Page } from '@playwright/test';
import { ElectronApplication, _electron as electron } from 'playwright';
import path from 'path';

// Determine the path to the electron app's main file
// This assumes that 'npm run build' (or a similar script) has been run
// and the output is in the 'out' directory, as specified in package.json "main"
const electronAppPath = path.join(__dirname, '..', 'out', 'main', 'index.js');

let electronApp: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  // Launch the Electron application
  electronApp = await electron.launch({
    args: [electronAppPath],
    // You might need to set executablePath if playwright cannot find electron,
    // or if you are using a specific version of electron.
    // executablePath: require('electron') // Example if electron is a dev dependency
  });

  // Wait for the first window to open
  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  // Close the Electron application
  if (electronApp) {
    await electronApp.close();
  }
});

test('App launches successfully and has one window', async () => {
  // Check if the window is visible and exists
  expect(window).toBeTruthy();
  expect(await window.isVisible()).toBe(true);

  // Verify the number of windows opened
  const windowCount = electronApp.windows().length;
  expect(windowCount).toBe(1); // Or more, if your app opens multiple initial windows
});

test('Window has the correct title', async () => {
  // Replace 'Aider Desk' with the expected title of your application window
  const expectedTitle = 'Aider Desk';
  const actualTitle = await window.title();
  expect(actualTitle).toBe(expectedTitle);
});

test('Window is not minimized and is visible', async () => {
  expect(await window.isClosed()).toBe(false);
  // isMinimized() is not directly available on Page, but visibility and window state can be checked
  // For more detailed checks, you might need to execute Electron-specific JavaScript
  // For example, to check if the window is minimized:
  // const isMinimized = await electronApp.evaluate(async ({BrowserWindow}) => {
  //   const mainWin = BrowserWindow.getAllWindows()[0];
  //   return mainWin.isMinimized();
  // });
  // expect(isMinimized).toBe(false);
  expect(await window.isVisible()).toBe(true);
});
