import { useState, useCallback } from 'react';

export const useInputState = () => {
  const [input, setInput] = useState('');

  const clearInput = useCallback(() => {
    setInput('');
  }, []);

  const addCharacter = useCallback((char: string) => {
    setInput(prev => prev + char);
  }, []);

  const removeLastCharacter = useCallback(() => {
    setInput(prev => prev.slice(0, -1));
  }, []);

  const insertFileReference = useCallback((filePath: string) => {
    setInput(prevInput => {
      const atIndex = prevInput.lastIndexOf('@');
      
      if (atIndex !== -1) {
        const beforeAt = prevInput.substring(0, atIndex);
        const afterAt = prevInput.substring(prevInput.indexOf(' ', atIndex) !== -1 ? prevInput.indexOf(' ', atIndex) : prevInput.length);
        return `${beforeAt}@${filePath} ${afterAt}`;
      }
      
      return prevInput;
    });
  }, []);

  return {
    input,
    setInput,
    clearInput,
    addCharacter,
    removeLastCharacter,
    insertFileReference
  };
};