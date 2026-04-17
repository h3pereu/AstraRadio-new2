const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'App.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const replacements = {
    891: "      setStatusMessage('Vyplňte e-mail, uživatelské jméno a platformu.');",
    913: "          payload?.error || 'Odeslání se nezdařilo. Zkuste to prosím znovu.',",
    918: "      setStatusMessage('Formulář byl odeslán. Děkujeme!');",
    923: "          : 'Odeslání se nezdařilo. Zkuste to prosím znovu.';",
    1075: "          setError('Nepodařilo se načíst novinky.');",
    1110: "      setDetailError('Nepodařilo se načíst článek.');",
    1256: "          <Text style={styles.emptyTitle}>Zatím žádné novinky</Text>",
    1257: "          <Text style={styles.emptySubtitle}>Jakmile něco zveřejníme, uvidíte to tady.</Text>",
    1382: "          setError('Nepodařilo se načíst playlist.');",
    1549: "              : 'Žádné skladby'}",
    1551: "          <Text style={styles.emptySubtitle}>Jakmile začne hrát hudba, zobrazíme ji tady.</Text>"
};

let changed = false;
Object.entries(replacements).forEach(([lineNum, newText]) => {
    const index = parseInt(lineNum) - 1; // 1-based to 0-based
    if (lines[index]) {
        // console.log(`Replacing line ${lineNum}:`);
        // console.log(`Old: ${lines[index]}`);
        // console.log(`New: ${newText}`);
        lines[index] = newText;
        changed = true;
    }
});

if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log('Successfully updated App.tsx with corrected Czech text.');
} else {
    console.log('No changes made.');
}
