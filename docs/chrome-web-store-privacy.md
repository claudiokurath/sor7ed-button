# Chrome Web Store privacy declarations

Checked against extension/manifest.json and extension/background.js, 4 November 2026.
The currently uploaded store package may be an older copy: verify its manifest
and use the matching current package before submission. These are suggested
technical declarations; the publisher must review its actual data practices
before making the dashboard certifications.

## Single purpose
Save web pages and links chosen by the user to their SOR7ED account and WhatsApp conversation, so they can return to them later.

## activeTab
Gives temporary access to the page the user explicitly chooses to save by clicking the extension or using its context menu. SOR7ED reads the page address, title and available preview metadata for that requested save. It does not continuously monitor browsing.

## scripting
Runs the extension's bundled metadata-capture function in the selected page to read its title, address, description and preview-image link. The current release also runs its bundled approval function in the SOR7ED save window to authorise the user's selected save. No remotely downloaded script is injected or evaluated.

## contextMenus
Adds a Save with SOR7ED option to the right-click menu for pages and links, allowing users to explicitly choose the page or link they want to save to WhatsApp.

## Host permission, if shown for the current package
https://www.sor7ed.com/* is used only to run the bundled approval function in the first-party SOR7ED save window opened by the user's save action. This authorises that selected save and lets its progress window close after acceptance. Page capture on other websites uses temporary activeTab permission instead of an all-sites host grant.

## Remote code
Select No, I am not using remote code. All executable extension code is packaged in the ZIP. The extension opens an ordinary HTTPS SOR7ED website for sign-in and server-backed saving/delivery; it does not download, evaluate or inject executable code from that website into the extension.

## Policy and account settings
Policy URL: https://www.sor7ed.com/privacy-policy
Publisher contact email: enter a real monitored email in publisher Settings and
complete the email verification there. Never invent an address.

Do not declare that no data is handled: selected-page URLs and metadata are
transmitted, and account/verification details are handled by the companion
service. Match the data-category checkboxes and publisher certifications to the
actual released product and current privacy notice.
