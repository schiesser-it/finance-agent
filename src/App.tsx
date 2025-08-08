import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface FileMatch {
  path: string;
  display: string;
}

const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string[]>([
    'Welcome to Interactive CLI!',
    'Available commands:',
    '  /status - Show current CLI status',
    '  /help - Show available commands', 
    '  /quit - Exit the application',
    'Type @ followed by text to reference files.',
    'Enter any text as a prompt to execute it.',
    ''
  ]);
  const [fileMatches, setFileMatches] = useState<FileMatch[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [showingFiles, setShowingFiles] = useState(false);
  
  const { exit } = useApp();

  const findFiles = async (query: string): Promise<FileMatch[]> => {
    try {
      const findFilesRecursive = (dir: string, files: string[] = []): string[] => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          if (item === 'node_modules' || item === '.git' || item === 'dist') continue;
          const fullPath = path.join(dir, item);
          if (fs.statSync(fullPath).isDirectory()) {
            findFilesRecursive(fullPath, files);
          } else {
            files.push(fullPath);
          }
        }
        return files;
      };
      
      const allFiles = findFilesRecursive('.');
      return allFiles
        .filter(file => file.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10)
        .map(file => ({
          path: file.replace('./', ''),
          display: path.basename(file)
        }));
    } catch {
      return [];
    }
  };

  const availableCommands = [
    '/status - Show current CLI status',
    '/help - Show available commands',
    '/quit - Exit the application'
  ];

  const handleCommand = async (command: string) => {
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
  };

  const executePrompt = (prompt: string) => {
    setOutput(prev => [...prev, `> ${prompt}`]);
    
    const child = spawn('echo', [prompt], { stdio: 'pipe' });
    
    child.stdout.on('data', (data) => {
      setOutput(prev => [...prev, data.toString().trim()]);
    });
    
    child.stderr.on('data', (data) => {
      setOutput(prev => [...prev, `Error: ${data.toString().trim()}`]);
    });
  };

  const updateFileMatches = async (inputText: string) => {
    const atIndex = inputText.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const query = inputText.substring(atIndex + 1);
      if (query.length > 0 && !query.includes(' ')) {
        const matches = await findFiles(query);
        setFileMatches(matches);
        setShowingFiles(matches.length > 0);
        setSelectedFileIndex(0);
      } else {
        setFileMatches([]);
        setShowingFiles(false);
      }
    } else {
      setFileMatches([]);
      setShowingFiles(false);
    }
  };

  useEffect(() => {
    updateFileMatches(input);
  }, [input]);

  const insertFileReference = (filePath: string) => {
    const atIndex = input.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const beforeAt = input.substring(0, atIndex);
      const afterAt = input.substring(input.indexOf(' ', atIndex) !== -1 ? input.indexOf(' ', atIndex) : input.length);
      const newInput = `${beforeAt}@${filePath} ${afterAt}`;
      setInput(newInput);
    }
    
    setFileMatches([]);
    setShowingFiles(false);
  };

  useInput((inputChar, key) => {
    if (key.ctrl && inputChar === 'c') {
      exit();
      return;
    }

    if (showingFiles) {
      if (key.upArrow) {
        setSelectedFileIndex(prev => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedFileIndex(prev => Math.min(fileMatches.length - 1, prev + 1));
        return;
      }
      if (key.return || key.tab) {
        insertFileReference(fileMatches[selectedFileIndex].path);
        return;
      }
      if (key.escape) {
        setFileMatches([]);
        setShowingFiles(false);
        return;
      }
    }

    if (key.return) {
      const trimmedInput = input.trim();
      if (trimmedInput.startsWith('/')) {
        handleCommand(trimmedInput);
      } else if (trimmedInput.length > 0) {
        executePrompt(trimmedInput);
      }
      setInput('');
      return;
    }

    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
      return;
    }

    if (inputChar && !key.ctrl && !key.meta) {
      setInput(prev => prev + inputChar);
    }
  });

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginBottom={1}>
        <Text color="cyan">Interactive CLI - Type your prompt, use /commands, or Ctrl+C to quit</Text>
        <Text color="gray">Use @ to reference files (e.g., @readme will show files containing 'readme')</Text>
      </Box>
      
      {output.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {output.map((line, index) => (
            <Text key={index} color={line.startsWith('>') ? 'green' : 'white'}>
              {line}
            </Text>
          ))}
        </Box>
      )}
      
      <Box>
        <Text color="blue">{'> '}</Text>
        <Text>{input}</Text>
        <Text>█</Text>
      </Box>
      
      {showingFiles && fileMatches.length > 0 && (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          <Text color="yellow">Files matching your query:</Text>
          {fileMatches.map((file, index) => (
            <Text 
              key={index} 
              color={index === selectedFileIndex ? 'black' : 'white'}
              backgroundColor={index === selectedFileIndex ? 'white' : undefined}
            >
              {file.path}
            </Text>
          ))}
          <Text color="gray" dimColor>
            Use ↑↓ to navigate, Enter to select, Esc to cancel
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default App;