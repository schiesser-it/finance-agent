import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
const Header = () => {
    return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { color: "cyan", children: "Interactive CLI - Type your prompt, use /commands, or Ctrl+C to quit" }), _jsx(Text, { color: "gray", children: "Use @ to reference files (e.g., @readme will show files containing 'readme')" })] }));
};
export default Header;
