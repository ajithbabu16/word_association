const fs = require('fs');
const path = require('path');
const wordsArray = require('an-array-of-english-words');

const dict = new Set(wordsArray.map(w => w.toLowerCase()));

const data = JSON.parse(rawData);
const levels = data.levels || [];

// Step 1: Build internal vocabulary from the game itself
const internalDict = new Set();
levels.forEach(level => {
  if (level.groups) {
    level.groups.forEach(group => {
      group.words.forEach(word => {
        const clean = word.trim().toLowerCase();
        // Only add single words to our dictionary
        if (!clean.includes(' ') && clean.length > 2) {
          internalDict.add(clean);
        }
      });
    });
  }
});

const foundWords = new Set();
const results = [];

levels.forEach(level => {
  if (level.groups) {
    level.groups.forEach(group => {
      group.words.forEach(word => {
        const clean = word.trim().toLowerCase();
        
        // Skip small words and words that already have a space
        if (clean.length < 7 || clean.includes(' ') || foundWords.has(clean)) return;

        foundWords.add(clean);

        // Try to split the word
        for (let i = 3; i <= clean.length - 3; i++) {
          const first = clean.substring(0, i);
          const second = clean.substring(i);

          if (internalDict.has(first) && internalDict.has(second)) {
            results.push({
              level: level.levelNumber,
              word: word,
              split: `${first.toUpperCase()} ${second.toUpperCase()}`
            });
            break; // found one valid split
          }
        }
      });
    });
  }
});

console.log(`Scanned all levels. Found ${results.length} possible missing space issues.`);
console.log(JSON.stringify(results.slice(0, 30), null, 2));
