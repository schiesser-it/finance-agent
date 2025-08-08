import { useState, useCallback } from 'react';
import * as fs from 'fs';
import * as path from 'path';
export const useFileSearch = () => {
    const [fileMatches, setFileMatches] = useState([]);
    const [selectedFileIndex, setSelectedFileIndex] = useState(0);
    const [showingFiles, setShowingFiles] = useState(false);
    const findFiles = useCallback(async (query) => {
        try {
            const findFilesRecursive = (dir, files = []) => {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    if (item === 'node_modules' || item === '.git' || item === 'dist')
                        continue;
                    const fullPath = path.join(dir, item);
                    if (fs.statSync(fullPath).isDirectory()) {
                        findFilesRecursive(fullPath, files);
                    }
                    else {
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
        }
        catch {
            return [];
        }
    }, []);
    const updateFileMatches = useCallback(async (inputText) => {
        const atIndex = inputText.lastIndexOf('@');
        if (atIndex !== -1) {
            const query = inputText.substring(atIndex + 1);
            if (query.length > 0 && !query.includes(' ')) {
                const matches = await findFiles(query);
                setFileMatches(matches);
                setShowingFiles(matches.length > 0);
                setSelectedFileIndex(0);
            }
            else {
                clearFileSearch();
            }
        }
        else {
            clearFileSearch();
        }
    }, [findFiles]);
    const clearFileSearch = useCallback(() => {
        setFileMatches([]);
        setShowingFiles(false);
    }, []);
    const selectPreviousFile = useCallback(() => {
        setSelectedFileIndex(prev => Math.max(0, prev - 1));
    }, []);
    const selectNextFile = useCallback(() => {
        setSelectedFileIndex(prev => Math.min(fileMatches.length - 1, prev + 1));
    }, [fileMatches.length]);
    return {
        fileMatches,
        selectedFileIndex,
        showingFiles,
        updateFileMatches,
        clearFileSearch,
        selectPreviousFile,
        selectNextFile
    };
};
