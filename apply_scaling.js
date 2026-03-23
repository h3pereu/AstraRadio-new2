const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'App.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// Find the start of styles
const styleStartRegex = /const styles = StyleSheet\.create\({/;
const match = styleStartRegex.exec(content);

if (!match) {
    console.error('Could not find styles definition');
    process.exit(1);
}

const startIndex = match.index;
const beforeStyles = content.substring(0, startIndex);
let stylesContent = content.substring(startIndex); // This assumes styles go to the end or we can process validly

// Regex to match properties that should be scaled
// We match generic structure: property: number, 
const propertyRegex = /^\s*(fontSize|lineHeight|width|height|padding|paddingVertical|paddingHorizontal|paddingTop|paddingBottom|paddingLeft|paddingRight|margin|marginVertical|marginHorizontal|marginTop|marginBottom|marginLeft|marginRight|borderRadius|gap|top|bottom|left|right): (\d+(\.\d+)?),/gm;

// Helper to determine if we should scale
const ignoredValues = [0, 1, '100%']; // 0 and 1 usually don't need scaling (borders, etc), though 1px border might be debatable. Let's skip 0 and 1.

const newStylesContent = stylesContent.replace(propertyRegex, (match, prop, value) => {
    const num = parseFloat(value);
    if (num <= 1) return match; // Skip small values like 0, 1px borders

    // Skip if it looks like it's already scaled (not possible with this simple regex but safe for first run)

    return match.replace(`: ${value},`, `: globalScale(${value}),`);
});

const newContent = beforeStyles + newStylesContent;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully applied globalScale to App.tsx styles');
