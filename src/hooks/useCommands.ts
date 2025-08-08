import { useState, useCallback } from 'react';
import { spawn } from 'child_process';
import { useApp } from 'ink';

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
    setOutput(prev => [...prev, `> ${prompt}`]);
    
    const child = spawn('echo', [prompt], { stdio: 'pipe' });
    
    child.stdout.on('data', (data) => {
      setOutput(prev => [...prev, data.toString().trim()]);
    });
    
    child.stderr.on('data', (data) => {
      setOutput(prev => [...prev, `Error: ${data.toString().trim()}`]);
    });
  }, []);

  return {
    output,
    handleCommand,
    executePrompt
  };
};