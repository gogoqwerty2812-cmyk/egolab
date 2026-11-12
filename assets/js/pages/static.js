// Static pages (blog articles, product snapshots in /p/): the content is plain
// HTML so search engines and AI crawlers can read it without JavaScript —
// this module only adds the shared header/footer for human visitors.
import { initTheme, mountChrome } from "../ui.js?v=23";

initTheme();
mountChrome(document.body.dataset.nav || "");
