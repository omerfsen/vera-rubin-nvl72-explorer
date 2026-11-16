// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Ajv2020 from 'ajv/dist/2020';
import schema from '../data/site.schema.json';
import site from '../data/site.json';
import { Credits } from '../src/components/Credits';

afterEach(cleanup);

describe('site credits', () => {
  it('match the schema', () => {
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
    expect(validate(site), JSON.stringify(validate.errors)).toBe(true);
  });

  it('show the author and the source link, and LinkedIn only when it is set', () => {
    render(<Credits />);
    expect(screen.getByText(/Made by Omer Sen/)).toBeTruthy();
    expect((screen.getByRole('link', { name: 'Source on GitHub' }) as HTMLAnchorElement).href).toBe(site.repository);
    expect(screen.queryAllByRole('link', { name: 'LinkedIn' }).length).toBe(site.author.linkedin ? 1 : 0);
    expect((screen.getByRole('link', { name: 'LinkedIn' }) as HTMLAnchorElement).href).toBe('https://www.linkedin.com/in/omerfsen/');
    expect((screen.getByRole('link', { name: 'omerfsen@gmail.com' }) as HTMLAnchorElement).href).toBe('mailto:omerfsen@gmail.com');
    expect((screen.getByRole('link', { name: 'Buy me a coffee' }) as HTMLAnchorElement).href).toBe('https://buymeacoffee.com/omerfsen');
  });
});
