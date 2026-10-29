/**
 * Client wording for grouped findings. One entry per issue code the check
 * runner reports. "what" says what's wrong, "why" says why it matters.
 * Copy rule: no dashes in client facing text.
 */
export type IssueText = { title: string; what: string; why: string }

export const ISSUE_TEXT: Record<string, IssueText> = {
  page_error: { title: 'Page shows an error', what: 'These pages show an error instead of their content.', why: 'Visitors who land here can’t see the page.' },
  server_error: { title: 'Server error', what: 'The server returned an error while loading these pages.', why: 'It may be temporary, so it needs a second look before it counts as a problem.' },
  redirect_loop: { title: 'Page never finishes loading', what: 'These pages keep redirecting and never load.', why: 'Visitors can’t reach them at all.' },
  redirect_outside: { title: 'Sends visitors to another site', what: 'These addresses forward to a site outside your domain.', why: 'It may be intended, or it may send visitors to the wrong place.' },
  redirect_unexpected: { title: 'Page moved', what: 'These agreed pages now forward to a different page.', why: 'Links and bookmarks may not land where you expect.' },
  cert_error: { title: 'Security certificate problem', what: 'The secure connection failed on these pages.', why: 'Visitors may see a security warning instead of your site.' },
  http_only: { title: 'Site isn’t using HTTPS', what: 'These pages open on an http address rather than https.', why: 'Browsers label them “not secure”, which can put visitors off.' },
  http_downgrade: { title: 'Secure pages switch to http', what: 'These pages start secure and end on an http address.', why: 'Browsers label them “not secure”.' },
  image_broken: { title: 'Images not loading', what: 'Some images on these pages don’t load.', why: 'Visitors see empty spaces or broken image icons.' },
  image_unverified: { title: 'Some images couldn’t be checked', what: 'A few image requests on these pages didn’t load during the check.', why: 'They may come from another service and may still show for visitors.' },
  overflow: { title: 'Page doesn’t fit the screen', what: 'These pages are wider than the screen, so they scroll sideways.', why: 'Parts of the page can be cut off, especially on phones.' },
  overflow_minor: { title: 'Slightly too wide', what: 'These pages are a few pixels wider than the screen.', why: 'It may not be noticeable; it needs a quick look.' },
  link_broken: { title: 'Broken links', what: 'Links on your pages lead to pages that no longer exist.', why: 'Visitors who click them reach an error page.' },
  blocked_by_site: { title: 'Site blocked the automated check', what: 'These pages showed an access or robot check page to the checker.', why: 'This isn’t a problem for visitors, but these pages weren’t verified automatically.' },
  timeout: { title: 'Too slow to check', what: 'These pages didn’t respond in time during the check.', why: 'A slow response isn’t proof of a problem, so they weren’t verified.' },
  not_allowed: { title: 'Address couldn’t be opened', what: 'The checker only opens public web addresses, so these weren’t opened.', why: 'These weren’t verified this month.' },
  dns: { title: 'Domain not found', what: 'The domain name couldn’t be found during the check.', why: 'It could be temporary, or the domain may need attention.' },
  connection: { title: 'Server didn’t respond', what: 'The server didn’t accept the connection.', why: 'It may be a short outage; it needs a second look.' },
  no_load: { title: 'Page didn’t finish loading', what: 'These pages didn’t finish loading during the check.', why: 'They weren’t verified this month.' },
  no_response: { title: 'Links didn’t respond', what: 'Some links didn’t respond during the check.', why: 'They may be temporary, so they weren’t verified.' },
  dest_error: { title: 'Outside service showed an error', what: 'A booking, checkout, or contact page from another service showed an error.', why: 'It may be temporary; it needs a second look.' },
  scan_incomplete: { title: 'Automated check didn’t finish', what: 'The automated check stopped before it finished.', why: 'Anything it didn’t reach wasn’t verified.' },
  screenshot_failed: { title: 'Screenshot missing', what: 'A screenshot couldn’t be captured.', why: 'The page was reviewed without it.' },
}

/** Agreed check rows shown in the client checklist, in order. */
export const CHECK_ROWS: { key: string; label: string; checks: string[] }[] = [
  { key: 'pages', label: 'Pages open', checks: ['page_load', 'redirects'] },
  { key: 'https', label: 'Secure connection (HTTPS)', checks: ['https'] },
  { key: 'images', label: 'Images load', checks: ['images'] },
  { key: 'fit', label: 'Fits desktop and phone screens', checks: ['overflow'] },
  { key: 'links', label: 'Links within the site work', checks: ['internal_links'] },
]

export const DESTINATION_NOTE: Record<string, string> = {
  booking: 'Page opens. Booking itself wasn’t tested by the automated check.',
  checkout: 'Page opens. Payment wasn’t tested.',
  contact: 'Page opens. Message delivery wasn’t tested.',
  other: 'Page opens.',
}

export function issueText(code: string | null | undefined, checkLabel: string): IssueText {
  return (code && ISSUE_TEXT[code]) || { title: checkLabel, what: 'The automated check reported a result that needs attention.', why: 'It needs a closer look.' }
}
