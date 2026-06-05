import fs from 'fs';
import path from 'path';

const extractKeys = (content) => {
  const regex = /(?:^|[^\w])t\(['"]([^'"]+)['"]\)/g;
  const keys = new Set();
  let match;
  while ((match = regex.exec(content)) !== null) {
    keys.add(match[1]);
  }
  return Array.from(keys);
};

const walk = (dir, fileList = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      walk(path.join(dir, file), fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
};

const allFiles = walk('./src');

const adminKeys = new Set();
const publicKeys = new Set();
const sharedKeys = new Set();

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const keys = extractKeys(content);
  
  const isAdmin = file.includes('/admin/') || file.includes('/app/api/v1/');
  const isPublic = file.includes('/(public)/');
  const isComponent = file.includes('/components/');
  const isGlobal = file.includes('/app/layout.tsx') || file.includes('/app/error.tsx') || file.includes('/app/not-found.tsx');
  
  keys.forEach(key => {
    if (isComponent || isGlobal) {
      // It's used in shared components or globally
      sharedKeys.add(key);
    } else if (isAdmin) {
      if (publicKeys.has(key)) {
        publicKeys.delete(key);
        sharedKeys.add(key);
      } else if (!sharedKeys.has(key)) {
        adminKeys.add(key);
      }
    } else if (isPublic) {
      if (adminKeys.has(key)) {
        adminKeys.delete(key);
        sharedKeys.add(key);
      } else if (!sharedKeys.has(key)) {
        publicKeys.add(key);
      }
    } else {
       // Other files (utils, lib, proxy, etc)
       sharedKeys.add(key);
    }
  });
}

// Any key in sharedKeys should be removed from admin/public
sharedKeys.forEach(key => {
  adminKeys.delete(key);
  publicKeys.delete(key);
});

console.log("=== ADMIN KEYS ===");
console.log(Array.from(adminKeys).join(', '));
console.log("\n=== PUBLIC KEYS ===");
console.log(Array.from(publicKeys).join(', '));
console.log("\n=== SHARED KEYS ===");
console.log(Array.from(sharedKeys).join(', '));
