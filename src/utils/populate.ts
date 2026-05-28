export function shouldPopulate(field: string, populateStr?: string): boolean {
  if (populateStr === undefined) return true;
  const parts = populateStr.split(",").map(s => s.trim());
  return parts.some(p => p === field || p.startsWith(`${field}.`));
}

export function getSubPopulateString(field: string, populateStr?: string): string | undefined {
  if (populateStr === undefined) return undefined;
  
  const parts = populateStr.split(",").map(s => s.trim());
  const subParts = parts
    .filter(p => p.startsWith(`${field}.`))
    .map(p => p.substring(field.length + 1));
    
  if (subParts.length > 0) {
    return subParts.join(",");
  }
  
  return undefined;
}
