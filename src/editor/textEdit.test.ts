import { describe, it, expect } from 'vitest';
import { insertText, toggleWrap } from './textEdit';

describe('toggleWrap', () => {
  it('wraps a selection and keeps the words selected', () => {
    expect(toggleWrap('Order - Stop', 0, 5, '**')).toEqual({ value: '**Order** - Stop', start: 2, end: 7 });
  });

  it('unwraps when the selection includes the markers', () => {
    expect(toggleWrap('**Order** - Stop', 0, 9, '**')).toEqual({ value: 'Order - Stop', start: 0, end: 5 });
  });

  it('unwraps when the markers sit just outside the selection', () => {
    expect(toggleWrap('**Order** - Stop', 2, 7, '**')).toEqual({ value: 'Order - Stop', start: 0, end: 5 });
  });

  it('does not mistake bold stars for italic ones', () => {
    expect(toggleWrap('**Order**', 2, 7, '*')).toEqual({ value: '***Order***', start: 3, end: 8 });
  });

  it('keeps edge spaces outside the markers', () => {
    expect(toggleWrap('Order - Stop', 0, 6, '**')).toEqual({ value: '**Order** - Stop', start: 2, end: 7 });
    expect(toggleWrap('a  b', 1, 3, '*')).toEqual({ value: 'a  **b', start: 4, end: 4 });
  });

  it('inserts an empty pair for a caret', () => {
    expect(toggleWrap('ab', 1, 1, '*')).toEqual({ value: 'a**b', start: 2, end: 2 });
  });

  it('accepts a backwards selection', () => {
    expect(toggleWrap('abc', 3, 0, '*')).toEqual({ value: '*abc*', start: 1, end: 4 });
  });
});

describe('insertText', () => {
  it('replaces the selection and moves the caret after the insertion', () => {
    expect(insertText('a XX b', 2, 4, '{icon:klingon}')).toEqual({ value: 'a {icon:klingon} b', start: 16, end: 16 });
  });

  it('adds spaces only where the insertion would touch a word', () => {
    expect(insertText('play ship', 4, 4, '{icon:klingon}', { spaced: true })).toEqual({ value: 'play {icon:klingon} ship', start: 19, end: 19 });
    expect(insertText('play ship', 5, 5, '{icon:klingon}', { spaced: true })).toEqual({ value: 'play {icon:klingon} ship', start: 20, end: 20 });
    expect(insertText('play', 4, 4, '{icon:klingon}', { spaced: true })).toEqual({ value: 'play {icon:klingon}', start: 19, end: 19 });
    expect(insertText('', 0, 0, '**Order** – ', { spaced: true })).toEqual({ value: '**Order** – ', start: 12, end: 12 });
    expect(insertText('a\nb', 2, 2, '**Order** – ', { spaced: true })).toEqual({ value: 'a\n**Order** – b', start: 14, end: 14 });
  });
});
