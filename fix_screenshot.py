#!/usr/bin/env python3
"""Fix screenshot-capture.ts syntax error"""

import re

SCREENSHOT_FILE = 'packages/backend/src/scanners/url-scanner-v2/screenshot-capture.ts'

with open(SCREENSHOT_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the problematic section
# It has:
# this.browser = await puppeteer.launch({
#   const executablePath = this.findChromiumPath();
#   this.browser = await puppeteer.launch({

pattern = r'''  async initBrowser\(\): Promise<void> \{
    if \(!this\.browser\) \{
      try \{
        this\.browser = await puppeteer\.launch\(\{
          const executablePath = this\.findChromiumPath\(\);

          this\.browser = await puppeteer\.launch\(\{
            executablePath,
          args: \['''

replacement = '''  async initBrowser(): Promise<void> {
    if (!this.browser) {
      try {
        const executablePath = this.findChromiumPath();

        this.browser = await puppeteer.launch({
          executablePath,
          args: ['''

content = re.sub(pattern, replacement, content, flags=re.MULTILINE)

with open(SCREENSHOT_FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print('[OK] Fixed screenshot-capture.ts syntax error')
