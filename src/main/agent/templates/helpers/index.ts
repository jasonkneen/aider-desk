import { registerConditionalHelpers } from './conditional';
import { registerFormattingHelpers } from './formatting';

export const registerAllHelpers = (): void => {
  registerConditionalHelpers();
  registerFormattingHelpers();
};
