import { jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
const OutputDisplay = ({ output }) => {
    if (output.length === 0) {
        return null;
    }
    return (_jsx(Box, { flexDirection: "column", marginBottom: 1, children: output.map((line, index) => (_jsx(Text, { color: line.startsWith('>') ? 'green' : 'white', children: line }, index))) }));
};
export default OutputDisplay;
