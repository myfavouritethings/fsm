const greekLetterNames = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho',
  'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega',
];

export function convertLatexShortcuts(text: string): string {
  let result = text;
  for (let i = 0; i < greekLetterNames.length; i++) {
    const name = greekLetterNames[i];
    result = result.replace(new RegExp(`\\\\${name}`, 'g'), String.fromCharCode(913 + i + (i > 16 ? 1 : 0)));
    result = result.replace(
      new RegExp(`\\\\${name.toLowerCase()}`, 'g'),
      String.fromCharCode(945 + i + (i > 16 ? 1 : 0)),
    );
  }
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(`_${i}`, 'g'), String.fromCharCode(8320 + i));
  }
  return result;
}

export function textToXML(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let result = '';
  for (let i = 0; i < escaped.length; i++) {
    const c = escaped.charCodeAt(i);
    if (c >= 0x20 && c <= 0x7e) {
      result += escaped[i];
    } else {
      result += `&#${c};`;
    }
  }
  return result;
}
