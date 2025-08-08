import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
const FileSearch = ({ fileMatches, selectedIndex, isVisible }) => {
    if (!isVisible || fileMatches.length === 0) {
        return null;
    }
    return (_jsxs(Box, { flexDirection: "column", marginTop: 1, marginLeft: 2, children: [_jsx(Text, { color: "yellow", children: "Files matching your query:" }), fileMatches.map((file, index) => (_jsx(Text, { color: index === selectedIndex ? 'black' : 'white', backgroundColor: index === selectedIndex ? 'white' : undefined, children: file.path }, index))), _jsx(Text, { color: "gray", dimColor: true, children: "Use \u2191\u2193 to navigate, Enter/Tab to select, Esc to cancel" })] }));
};
export default FileSearch;
