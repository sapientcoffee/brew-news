import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Button } from '../button';

describe('Button', () => {
  it('should render a button with the correct text', () => {
    render(<Button>Click Me</Button>);
    const button = screen.getByRole('button', { name: /Click Me/i });
    expect(button).toBeInTheDocument();
  });
});
