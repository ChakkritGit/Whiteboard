/**
 * Two languages, one dictionary.
 *
 * `en` is the source of truth: `th` is typed against it, so a string added to
 * one and forgotten in the other is a compile error rather than an English word
 * appearing in the middle of a Thai sentence.
 *
 * The board's language is a stored preference rather than a path segment. A room
 * URL gets pasted into chats and sent to people who may not read the language of
 * whoever made it — putting a locale in that link would hand your language to
 * everyone you share the board with. The front page is the opposite case: it has
 * to be crawled, so it exists at `/` and `/th` as two real pages.
 *
 * Deliberately *not* `'use client'`. Everything a client module exports becomes
 * a client reference when a server component imports it — including a plain
 * object — so the front page would have received a proxy where the words should
 * be, and `DICT[lang].tagline` was `undefined` at build time. The hook that
 * reads the stored preference lives next door in `i18n.ts`; the words live here,
 * where both sides can read them.
 */
export type Lang = 'en' | 'th'

const en = {
  /* ------------------------------- the board ------------------------------ */
  boardTitle: 'Board title',
  untitled: 'Untitled board',
  live: 'Live',
  offline: 'Offline',
  connectedTo: (url: string) => `Connected to ${url}`,
  notConnectedTo: (url: string) => `Not connected to ${url}`,
  themeLight: 'Light theme',
  themeDark: 'Dark theme',
  themeSystem: 'Match the system',
  language: 'Language',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetZoom: 'Back to 100%',
  undo: 'Undo',
  redo: 'Redo',
  fit: 'Fit',
  exportBoard: 'Export board',
  exportJson: 'Board file (JSON)',
  exportEmpty: 'There is nothing on the board to export yet.',
  exportFailed: 'Could not make that file.',
  importBoard: 'Import board',
  share: 'Share',
  linkCopied: 'Link copied',

  toolSelect: 'Select',
  toolPen: 'Pen',
  toolHighlighter: 'Highlighter',
  toolEraser: 'Eraser',
  toolShape: 'Rectangle',
  toolSticky: 'Sticky note',
  toolText: 'Text',
  toolFrame: 'Frame',
  colour: 'Colour',
  penWidth: (n: number) => `Pen width ${n}`,
  weightLight: 'Light',
  weightRegular: 'Regular',
  weightBold: 'Bold',
  weightBlack: 'Black',

  people: 'People',
  layers: 'Layers',
  inThisRoom: 'In this room',
  onTheBoard: 'On the board',
  yourName: 'Your name',
  you: 'you',
  jumpTo: (name: string) => `Jump to ${name}`,
  notOnBoard: (name: string) => `${name} is not on the board`,
  nothingYet: 'Nothing on the board yet.',
  bringToFront: 'Bring to front',
  sendToBack: 'Send to back',
  lock: 'Lock',
  unlock: 'Unlock',
  expand: 'Expand',
  collapse: 'Collapse',
  map: 'Map',
  rotate: 'Rotate',

  kindSticky: 'note',
  kindShape: 'box',
  kindText: 'text',
  kindFrame: 'frame',
  kindStroke: 'stroke',

  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  duplicate: 'Duplicate',
  group: 'Group',
  ungroup: 'Ungroup',
  del: 'Delete',
  selectAll: 'Select all',
  fitToContent: 'Fit to content',
  groupName: (n: number) => `Group ${n}`,

  newNote: 'New note',
  newText: 'Text',
  newFrame: 'Frame',
  loaded: (count: number, file: string) => `Loaded ${count} items from ${file}`,
  unreadable: 'That file could not be read.',
  fileNotJson: 'That file is not JSON.',
  fileNotOurs: 'That is not a whiteboard file.',
  fileNewer: (version: string) => `This board was written by a newer version (${version}).`,
  fileNoItems: 'That file has no items in it.',
  fileDamaged: 'Some items in that file are damaged.',

  /* ----------------------------- the front page ---------------------------- */
  tagline: 'A shared whiteboard with nothing to sign in to',
  metaDescription:
    'A free online whiteboard you can share with a link. No account, no install — open a board, send the URL, and everyone draws, writes and moves sticky notes together in real time. Export and import your board as a file.',
  heroBody:
    'Open a board, send the link, and whoever follows it is already in the room with you — drawing, writing and moving sticky notes on the same canvas, at the same time. No account, no install, nothing to pay for.',
  startBoard: 'Start a board',
  openNewBoard: 'Open a new board',
  opening: 'Opening…',
  freeNoSignup: 'Free · no sign-up · works in any browser',
  source: 'Source',
  whatItDoes: 'What it does',
  howItWorks: 'How it works',
  questions: 'Questions',
  ctaHeading: 'Start a board',
  ctaBody: 'It takes one click, and the link is ready to send the moment it opens.',
  footer: 'Whiteboard — a shared board, and nothing to sign in to.',

  features: [
    {
      title: 'Nothing to sign in to',
      body: 'No account, no email, no install. The link is the whole of the access control — whoever has it is in the room, and whoever does not, is not.',
    },
    {
      title: 'Everyone at once',
      body: 'Notes, drawings and text arrive as they are made, with each person’s cursor and name on the board beside them. No refreshing, no saving, no taking turns.',
    },
    {
      title: 'Yours to keep',
      body: 'Export the board to a plain JSON file you can read, diff and commit, and import it back into any room. Your work is not trapped in somebody else’s database.',
    },
    {
      title: 'Works offline',
      body: 'The board is kept in your browser as well as in the room, so it opens instantly, survives a dropped connection, and catches up when you come back.',
    },
    {
      title: 'The tools you reach for',
      body: 'Sticky notes, text, boxes, frames, a pen and a highlighter, an eraser, groups, layers, undo — with a right-click menu, and a light, dark and system theme.',
    },
    {
      title: 'Free and open',
      body: 'The whole thing is on GitHub, room server included. Run it on your own machine, or deploy the rooms to a Cloudflare Worker and pay nothing.',
    },
  ],
  steps: [
    ['Open a board', 'One click. It is yours the moment it exists — no setup, no naming, no project to create first.'],
    ['Send the link', 'Copy the URL out of the address bar, or press Share. Anyone who opens it is standing on the same board as you.'],
    ['Work on it together', 'Everything anyone does shows up for everyone else as it happens. Export the file when you are done, or leave it and come back.'],
  ] as [string, string][],
  faq: [
    ['Is it really free?', 'Yes. There is no account to make and nothing to pay for. The source is on GitHub and you can run your own copy if you would rather.'],
    ['Do I need to sign up or install anything?', 'No. It runs in the browser and there is no sign-in step at all. Opening the link is joining the board.'],
    ['If two people each share their own link, do the boards get mixed up?', 'No. Each link is its own room, and rooms never see each other. Two people working on two links are working on two separate boards.'],
    ['Who can see my board?', 'Whoever has the link. The room id is random and unguessable, and it is the whole of the access control — so treat the link the way you would treat the board itself.'],
    ['Can I get my work out?', 'Export writes a plain JSON file with everything on the board in it, and import reads it back into any room. Nothing is locked in.'],
  ] as [string, string][],
}

// Deliberately not `as const`: with literal types, `th` would have to be the
// same words as `en` to satisfy the shape, which is the opposite of the point.
type Dict = typeof en

const th: Dict = {
  boardTitle: 'ชื่อบอร์ด',
  untitled: 'บอร์ดไม่มีชื่อ',
  live: 'ออนไลน์',
  offline: 'ออฟไลน์',
  connectedTo: (url: string) => `เชื่อมต่อกับ ${url}`,
  notConnectedTo: (url: string) => `ยังไม่ได้เชื่อมต่อกับ ${url}`,
  themeLight: 'ธีมสว่าง',
  themeDark: 'ธีมมืด',
  themeSystem: 'ตามระบบ',
  language: 'ภาษา',
  zoomIn: 'ขยาย',
  zoomOut: 'ย่อ',
  resetZoom: 'กลับไป 100%',
  undo: 'ย้อนกลับ',
  redo: 'ทำซ้ำ',
  fit: 'พอดีจอ',
  exportBoard: 'ส่งออกบอร์ด',
  exportJson: 'ไฟล์บอร์ด (JSON)',
  exportEmpty: 'ยังไม่มีอะไรบนบอร์ดให้ส่งออก',
  exportFailed: 'สร้างไฟล์ไม่สำเร็จ',
  importBoard: 'นำเข้าบอร์ด',
  share: 'แชร์',
  linkCopied: 'คัดลอกลิงก์แล้ว',

  toolSelect: 'เลือก',
  toolPen: 'ดินสอ',
  toolHighlighter: 'ปากกาเน้นข้อความ',
  toolEraser: 'ยางลบ',
  toolShape: 'สี่เหลี่ยม',
  toolSticky: 'โน้ต',
  toolText: 'ข้อความ',
  toolFrame: 'กรอบ',
  colour: 'สี',
  penWidth: (n: number) => `ความหนาดินสอ ${n}`,
  weightLight: 'บาง',
  weightRegular: 'ปกติ',
  weightBold: 'หนา',
  weightBlack: 'หนามาก',

  people: 'คน',
  layers: 'เลเยอร์',
  inThisRoom: 'คนในห้องนี้',
  onTheBoard: 'ของบนบอร์ด',
  yourName: 'ชื่อของคุณ',
  you: 'คุณ',
  jumpTo: (name: string) => `ไปหา ${name}`,
  notOnBoard: (name: string) => `${name} ยังไม่ได้อยู่บนบอร์ด`,
  nothingYet: 'ยังไม่มีอะไรบนบอร์ด',
  bringToFront: 'ย้ายมาหน้าสุด',
  sendToBack: 'ย้ายไปหลังสุด',
  lock: 'ล็อก',
  unlock: 'ปลดล็อก',
  expand: 'กางออก',
  collapse: 'ยุบเข้า',
  map: 'แผนที่',
  rotate: 'หมุน',

  kindSticky: 'โน้ต',
  kindShape: 'กล่อง',
  kindText: 'ข้อความ',
  kindFrame: 'กรอบ',
  kindStroke: 'เส้น',

  cut: 'ตัด',
  copy: 'คัดลอก',
  paste: 'วาง',
  duplicate: 'ทำสำเนา',
  group: 'จัดกลุ่ม',
  ungroup: 'แยกกลุ่ม',
  del: 'ลบ',
  selectAll: 'เลือกทั้งหมด',
  fitToContent: 'ย่อให้เห็นทั้งหมด',
  groupName: (n: number) => `กลุ่ม ${n}`,

  newNote: 'โน้ตใหม่',
  newText: 'ข้อความ',
  newFrame: 'กรอบ',
  loaded: (count: number, file: string) => `โหลด ${count} ชิ้นจาก ${file} แล้ว`,
  unreadable: 'อ่านไฟล์นี้ไม่ได้',
  fileNotJson: 'ไฟล์นี้ไม่ใช่ JSON',
  fileNotOurs: 'ไฟล์นี้ไม่ใช่ไฟล์ไวท์บอร์ด',
  fileNewer: (version: string) => `บอร์ดนี้ถูกบันทึกด้วยเวอร์ชันที่ใหม่กว่า (${version})`,
  fileNoItems: 'ไฟล์นี้ไม่มีอะไรอยู่ข้างใน',
  fileDamaged: 'มีบางชิ้นในไฟล์นี้เสียหาย',

  tagline: 'ไวท์บอร์ดออนไลน์ที่ไม่ต้องสมัครอะไรเลย',
  metaDescription:
    'ไวท์บอร์ดออนไลน์ฟรี แชร์ด้วยลิงก์เดียว ไม่ต้องสมัครสมาชิก ไม่ต้องติดตั้ง เปิดบอร์ด ส่งลิงก์ แล้วทุกคนวาด เขียน และเลื่อนโน้ตด้วยกันได้ทันทีแบบเรียลไทม์ ส่งออกและนำเข้าบอร์ดเป็นไฟล์ได้',
  heroBody:
    'เปิดบอร์ด ส่งลิงก์ให้เพื่อน แล้วคนที่กดเข้ามาก็อยู่ในห้องเดียวกับคุณทันที วาด เขียน และเลื่อนโน้ตบนผืนผ้าใบเดียวกันพร้อมกัน ไม่ต้องสมัคร ไม่ต้องติดตั้ง ไม่มีค่าใช้จ่าย',
  startBoard: 'เริ่มบอร์ดใหม่',
  openNewBoard: 'เปิดบอร์ดใหม่',
  opening: 'กำลังเปิด…',
  freeNoSignup: 'ฟรี · ไม่ต้องสมัคร · ใช้ได้ทุกเบราว์เซอร์',
  source: 'ซอร์สโค้ด',
  whatItDoes: 'ทำอะไรได้บ้าง',
  howItWorks: 'ใช้งานยังไง',
  questions: 'คำถามที่พบบ่อย',
  ctaHeading: 'เริ่มบอร์ดใหม่',
  ctaBody: 'กดครั้งเดียว แล้วลิงก์ก็พร้อมส่งให้ใครก็ได้ทันที',
  footer: 'Whiteboard — บอร์ดที่แชร์กันได้ โดยไม่ต้องสมัครอะไรเลย',

  features: [
    {
      title: 'ไม่ต้องสมัครอะไรเลย',
      body: 'ไม่มีบัญชี ไม่ต้องกรอกอีเมล ไม่ต้องติดตั้ง ลิงก์คือสิทธิ์เข้าถึงทั้งหมด ใครมีลิงก์คือคนในห้อง ใครไม่มีก็เข้าไม่ได้',
    },
    {
      title: 'ทุกคนพร้อมกัน',
      body: 'โน้ต ลายเส้น และข้อความปรากฏทันทีที่มีคนทำ พร้อมเคอร์เซอร์และชื่อของแต่ละคนบนบอร์ด ไม่ต้องรีเฟรช ไม่ต้องกดบันทึก ไม่ต้องผลัดกันทำ',
    },
    {
      title: 'งานเป็นของคุณ',
      body: 'ส่งออกบอร์ดเป็นไฟล์ JSON ธรรมดาที่เปิดอ่านและเก็บลง git ได้ แล้วนำเข้ากลับห้องไหนก็ได้ งานของคุณไม่ได้ถูกขังไว้ในฐานข้อมูลของคนอื่น',
    },
    {
      title: 'ออฟไลน์ก็ยังใช้ได้',
      body: 'บอร์ดถูกเก็บไว้ในเบราว์เซอร์ของคุณควบคู่กับในห้อง เปิดปุ๊บติดปั๊บ เน็ตหลุดก็ไม่หาย และตามข้อมูลให้ทันทีที่กลับมา',
    },
    {
      title: 'เครื่องมือที่ต้องใช้จริง',
      body: 'โน้ต ข้อความ กล่อง กรอบ ดินสอ ปากกาเน้นข้อความ ยางลบ จัดกลุ่ม เลเยอร์ ย้อนกลับ พร้อมเมนูคลิกขวา และธีมสว่าง มืด ตามระบบ',
    },
    {
      title: 'ฟรีและโอเพนซอร์ส',
      body: 'โค้ดทั้งหมดอยู่บน GitHub รวมเซิร์ฟเวอร์ห้องด้วย จะรันบนเครื่องตัวเองหรือ deploy ห้องขึ้น Cloudflare Worker แบบไม่เสียเงินก็ได้',
    },
  ],
  steps: [
    ['เปิดบอร์ด', 'กดครั้งเดียว บอร์ดเป็นของคุณตั้งแต่วินาทีที่มันเกิดขึ้น ไม่ต้องตั้งค่า ไม่ต้องตั้งชื่อ ไม่ต้องสร้างโปรเจกต์ก่อน'],
    ['ส่งลิงก์', 'คัดลอก URL จากช่องที่อยู่ หรือกดปุ่มแชร์ ใครเปิดลิงก์นั้นก็ยืนอยู่บนบอร์ดเดียวกับคุณ'],
    ['ทำงานด้วยกัน', 'ทุกอย่างที่ใครทำจะขึ้นให้คนอื่นเห็นทันที เสร็จแล้วส่งออกเป็นไฟล์ หรือปล่อยไว้แล้วค่อยกลับมาก็ได้'],
  ],
  faq: [
    ['ฟรีจริงไหม', 'ฟรีจริง ไม่มีบัญชีให้สมัครและไม่มีอะไรต้องจ่าย ซอร์สโค้ดอยู่บน GitHub ถ้าอยากรันเองก็ทำได้'],
    ['ต้องสมัครหรือติดตั้งอะไรไหม', 'ไม่ต้อง ใช้งานผ่านเบราว์เซอร์และไม่มีขั้นตอนล็อกอินเลย เปิดลิงก์คือเข้าห้องแล้ว'],
    ['ถ้าสองคนต่างแชร์ลิงก์ของตัวเอง บอร์ดจะปนกันไหม', 'ไม่ปน แต่ละลิงก์คือคนละห้อง และห้องมองไม่เห็นกัน สองคนที่ทำงานบนสองลิงก์คือทำงานบนสองบอร์ดแยกกัน'],
    ['ใครเห็นบอร์ดของเราได้บ้าง', 'คนที่มีลิงก์เท่านั้น รหัสห้องเป็นตัวสุ่มที่เดาไม่ได้ และมันคือสิทธิ์เข้าถึงทั้งหมด ดังนั้นให้ดูแลลิงก์เหมือนดูแลตัวบอร์ดเอง'],
    ['เอางานออกมาได้ไหม', 'ส่งออกได้เป็นไฟล์ JSON ธรรมดาที่มีทุกอย่างบนบอร์ด และนำเข้ากลับห้องไหนก็ได้ ไม่มีการล็อกข้อมูลไว้'],
  ],
}

export const DICT = { en, th } as const

export const LANG_KEY = 'whiteboard:lang'
