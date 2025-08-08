import { useState, useCallback, useRef } from 'react';
import { useApp } from 'ink';
import { ClaudeService } from '../services/claudeService.js';

const INITIAL_MESSAGES = [
  'Welcome to Interactive CLI!',
  'Available commands:',
  '  /status - Show current CLI status',
  '  /help - Show available commands', 
  '  /quit - Exit the application',
  'Type @ followed by text to reference files.',
  'Enter any text as a prompt to execute it.',
  ''
];

export const useCommands = () => {
  const [output, setOutput] = useState<string[]>(INITIAL_MESSAGES);
  const [isExecuting, setIsExecuting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { exit } = useApp();

  const availableCommands = [
    '/status - Show current CLI status',
    '/help - Show available commands',
    '/quit - Exit the application'
  ];

  const handleCommand = useCallback(async (command: string) => {
    if (command === '/status') {
      setOutput(prev => [...prev, '> /status', 'Status: Interactive CLI is running']);
      return;
    }
    
    if (command === '/help') {
      setOutput(prev => [...prev, '> /help', 'Available commands:', ...availableCommands]);
      return;
    }
    
    if (command === '/quit') {
      exit();
      return;
    }
    
    setOutput(prev => [...prev, `> ${command}`, 'Unknown command. Type /help for available commands.']);
  }, [exit, availableCommands]);

  const executePrompt = useCallback((prompt: string) => {
    if (isExecuting) {
      return; // Block if already executing
    }

    setIsExecuting(true);
    setOutput(prev => [...prev, `> ${prompt}`]);
    
    // Create new abort controller for this execution
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    // Execute in a non-blocking way
    ClaudeService.executePrompt(prompt, {
      abortController,
      onMessage: (message: string) => {
        setOutput(prev => [...prev, message]);
      }
    }).then(response => {
      if (!response.success && response.error) {
        // Check if it's an abort-related error
        if (response.error.includes('aborted') || response.error.includes('cancelled')) {
          setOutput(prev => [...prev, '⚠️  Operation cancelled by user']);
        } else {
          setOutput(prev => [...prev, `Error: ${response.error}`]);
        }
      }
    }).catch(error => {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        setOutput(prev => [...prev, '⚠️  Operation cancelled by user']);
      } else {
        setOutput(prev => [...prev, `Error: ${error instanceof Error ? error.message : String(error)}`]);
      }
    }).finally(() => {
      setIsExecuting(false);
      abortControllerRef.current = null;
    });
  }, [isExecuting]);

  const abortExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    output,
    handleCommand,
    executePrompt,
    isExecuting,
    abortExecution
  };
};