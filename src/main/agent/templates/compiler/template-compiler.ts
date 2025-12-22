import fs from 'fs/promises';
import path from 'path';

import Handlebars from 'handlebars';

import { registerAllHelpers } from '../helpers';

import { RESOURCES_DIR } from '@/constants';
import logger from '@/logger';

export class TemplateCompiler {
  private readonly templatesDir: string;
  private readonly compiledTemplates = new Map<string, HandlebarsTemplateDelegate>();

  constructor(templatesDir: string = path.join(RESOURCES_DIR, 'prompts')) {
    this.templatesDir = templatesDir;
    registerAllHelpers();
  }

  async compileAll(): Promise<void> {
    try {
      const entries = await fs.readdir(this.templatesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.hbs')) {
          const name = entry.name.replace('.hbs', '');
          const source = await fs.readFile(path.join(this.templatesDir, entry.name), 'utf8');
          this.compiledTemplates.set(name, Handlebars.compile(source, { noEscape: true }));
        }
      }
      logger.info(`Compiled ${this.compiledTemplates.size} templates from ${this.templatesDir}`);
    } catch (error) {
      logger.error('Template compilation failed:', error);
    }
  }

  render(name: string, data: unknown): string {
    const template = this.compiledTemplates.get(name);
    if (!template) {
      throw new Error(`Template ${name} not found`);
    }
    return template(data);
  }
}
