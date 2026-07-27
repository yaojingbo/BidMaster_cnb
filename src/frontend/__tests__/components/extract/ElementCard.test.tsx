import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ElementCard } from '../../../components/extract/ElementCard';

describe('ElementCard Component', () => {
  it('should render element name and content', () => {
    render(
      <ElementCard
        name="资质要求"
        content="具有相关资质证书"
        confidence={0.95}
      />
    );

    expect(screen.getByText('资质要求')).toBeDefined();
    expect(screen.getByText('具有相关资质证书')).toBeDefined();
  });

  it('should display confidence when provided', () => {
    render(
      <ElementCard
        name="资质要求"
        content="具有相关资质"
        confidence={0.95}
      />
    );

    expect(screen.getByText('95%')).toBeDefined();
  });

  it('should not display confidence when not provided', () => {
    render(
      <ElementCard
        name="资质要求"
        content="具有相关资质"
      />
    );

    expect(screen.queryByText('%')).toBeNull();
  });

  it('should apply highlighted class when isHighlighted is true', () => {
    const { container } = render(
      <ElementCard
        name="资质要求"
        content="具有相关资质"
        isHighlighted={true}
      />
    );

    const card = container.querySelector('[class*="highlighted"]');
    expect(card).toBeDefined();
  });
});
