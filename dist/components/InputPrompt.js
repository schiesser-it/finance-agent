import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
const InputPrompt = ({ input, isExecuting = false }) => {
    return (_jsxs(Box, { children: [_jsx(Text, { color: "blue", children: '> ' }), _jsx(Text, { children: input }), isExecuting ? (_jsx(Text, { color: "yellow", children: "[Agent Running... Press Ctrl+C to cancel]" })) : (_jsx(Text, { children: "\u2588" }))] }));
};
export default InputPrompt;
