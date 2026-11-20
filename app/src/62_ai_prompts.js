/* ---------------- prompt for the user's own AI ---------------- */
const USER_AI_PROMPT = `You are helping a teacher prepare an exam. Convert the exam material I give you (a photo, a PDF, pasted text, or my description of the exam I want) into plain text in EXACTLY the format below, so it can be pasted into an exam-building tool. Reply with only the formatted exam inside a single code block — no comments before or after.

FORMAT RULES
1. Start with the exam details you can find, one per line, using exactly these labels (leave out any you don't know):
   Title: …   Subtitle: …   Subject: …   Year: …   Duration: …   Teacher: …   Class: …
   Then  Instructions:  followed by one instruction per line, each starting with "- ".
   Do NOT copy student fill-in lines (Name: ____ Date: ____) — the tool prints its own.
2. If the material has a rubric, scoring table or marking criteria (or I ask for one), put it right after the details: a line  Rubric: <title of the rubric page>  then a Markdown table with the columns  | Criterion | Points |  (add a Description column in the middle if there are descriptions). One row per criterion; for a part with sub-criteria, give the part row first and then its sub-rows starting with A., B. or Question 1, Question 2. End with  | TOTAL | n |  and, if the original has it,  | TOTAL EXAM GRADE | % |.
3. Part headings on their own line, e.g.:  Part I: Algebra   — add the part's total marks if known:  Part I: Algebra [20]
   Sub-parts inside a part (A., B., …) on their own line starting with  Sub-part:  e.g.  Sub-part: A. Definitions (18 points)
   Do NOT copy the original's page breaks — BEE arranges the pages itself. Only put  {newpage}  on its own line where I ask for a new page.
   A question that has no number in the original (e.g. "Use the word … in a sentence:"): still number it like the others, and put  {nonum}  after its marks — the number is then left off the paper. Add  {nomarks}  if the original doesn't show its marks.
4. Instructions or reading passages that are not questions: plain paragraphs.
5. Every question starts on a new line with its number:  1. Question text
6. Marks go at the END of the question's first line in square brackets:  1. Solve the equation. [3]
7. If students must write the answer on the paper, add ruled answer lines after the marks:  [6] {lines: 8}
   Other answer spaces: {grid: 8} (squared paper), {box: 6}, {numberline: -10..10} (a number line, add "step 5" if needed), {axes: -6..6} or {axes: -2..8, -5..5} (a coordinate grid with x and y axes to draw on).
8. Multiple-choice options and sub-questions each go on their own line:  a) …   b) …   or   i) …   ii) …
   For multiple-choice questions add {mcq} after the marks (one correct answer) or {mcq: multi} (more than one correct answer). Add {cols: 2} or {cols: 4} to lay short options out in columns.
   Sub-questions with their own marks start with (a), (b), (c) and end with their marks:  (a) Name the gas. [1] {lines: 2}
   Short one-line questions can be printed two per row: add {half}.
9. Maths: LaTeX between single dollar signs inside sentences, e.g.  $x^2 + 3x - 4 = 0$,  $\\frac{3}{4}$,  $\\sqrt{2}$,  $90^\\circ$
10. Important equations on their own line between double dollar signs:  $$\\int_0^1 x^2\\,dx$$
11. Organic or biological structures that must be drawn (skeletal formulas): {mol: SMILES} on its own line, e.g.  {mol: CCO}  — add a caption only if the name may be shown:  {mol: CC(=O)O | ethanoic acid}
    Chemistry equations and formulas with mhchem:  $\\ce{H2SO4}$,  $\\ce{2H2 + O2 -> 2H2O}$,  $\\ce{N2 + 3H2 <=> 2NH3}$
12. Units:  $9.8\\,\\mathrm{m/s^2}$
13. Tables: Markdown tables (| a | b |, with a |---|---| line under the header row).
14. Biology: scientific names in italics (*Homo sapiens*), Punnett squares and data as Markdown tables, temperatures as $37^\\circ\\mathrm{C}$, sizes as $10\\,\\mu\\mathrm{m}$.
15. To centre or right-align a line (a poem, a title, a quotation), start the line with {center} or {right} ({left} keeps one line ragged when paragraphs are justified). To make a line bigger (a title) start it with {big} or {bigger}; smaller: {small}. They can be combined: {center}{big}The Water Cycle
    Text styles: **bold**, *italic*, ++underline++ and ~~strikethrough~~ — keep every one that appears in the original. Do not use any other Markdown (no # headings, no horizontal rules, no numbered-list auto-formatting).
16. EVERY picture, photo, diagram, graph, map or chart: never skip one. Two ways, on its own line exactly where it belongs:
    a) SIMPLE line diagrams — triangles, polygons, circles, angles, boxes and solids, axes, number lines, simple circuits, ray or force diagrams — DRAW them as SVG between a line {svg} and a line {/svg}:
       {svg}
       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220"> … </svg>
       {/svg}
       Black lines (stroke="#000" stroke-width="2" fill="none"), labels as <text font-family="Arial" font-size="16">, a small square for a right angle, an arc for a marked angle, dashed lines for hidden edges, everything inside the viewBox, roughly to scale. Copy every length, angle and label from the original. Do NOT draw answers or working unless I ask for the answer key.
    b) Everything else (photos, maps, detailed drawings, anything you can't draw well): write  [diagram: page N — short description]  where N is the page of the PDF it is on (leave out "page N —" if there are no pages). Include any caption or credit in the description.
17. Copy the wording exactly and keep the original numbering. Do NOT add answers or solutions unless I ask for them.
18. ONLY if I ask for an answer key: put {correct} after each correct MCQ option, and after a question or sub-question add a line starting with "Model answer:" followed by the answer or marking points.

EXAMPLE OUTPUT
Title: Unit 3 Test
Subject: Mathematics
Duration: 45 minutes
Instructions:
- Answer all questions.
- Show your working. If you make a mistake, ~~cross it out~~ neatly.
Rubric: Scoring by Section (for Teacher)
| Criterion | Points |
|---|---|
| Part I: Algebra | 8 |
| Presentation | 2 |
| TOTAL | 10 |
Part I: Algebra [8]
Answer all questions. Show your working.
1. Solve $2x + 5 = 17$. [2] {lines: 3}
2. Which of these is a factor of $x^2 - 9$? [1] {mcq}
a) $x - 3$
b) $x + 9$
c) $x - 9$
3. Find the length $x$. [2] {lines: 3}
{svg}
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 170"><polygon points="30,140 230,140 30,30" fill="none" stroke="#000" stroke-width="2"/><rect x="30" y="126" width="14" height="14" fill="none" stroke="#000" stroke-width="1.5"/><text x="120" y="162" font-family="Arial" font-size="16">8 cm</text><text x="6" y="90" font-family="Arial" font-size="16">6 cm</text><text x="140" y="78" font-family="Arial" font-size="16" font-style="italic">x</text></svg>
{/svg}
4. Look at the graph and evaluate the area under it: [5] {lines: 6}
[diagram: graph of y = 3x² + 1 from x = 0 to x = 2, area shaded]
$$\\int_0^2 (3x^2 + 1)\\,dx$$

Here is the exam material:
`;
const IXL_RULES = `IXL MATERIAL — extra rules (they win over the rules above)
19. Leave out IXL's page furniture: "© IXL Learning", "Name: ____", "Page 1 of 2 - www.ixl.com", the grey separator lines, skill codes (e.g. "A.3"), "Submit", progress bars and SmartScore.
20. The large heading at the top is the title:  Title: <that heading>  (even if it is generic, e.g. "TestQuiz" — the teacher will rename it).
21. IXL prints fractions stacked (numerator above the line, denominator below). Read the picture, not the text order, and write them in LaTeX: $\\frac{13}{500}$. Keep thousands separators inside braces: $\\frac{9{,}639}{10{,}000}$. Mixed numbers: $3\\frac{1}{4}$. The same for exponents, square roots and long division shown as pictures.
22. IXL gives no marks: put [1] after every question unless I tell you otherwise.
23. Answer spaces — turn IXL's boxes into BEE answer spaces:
    • one small empty box under or after a question (a number, a word) → {lines: 1}
    • a large box or "show your work" area → {lines: 4} (or more for longer answers)
    • several boxes inside a sentence or an equation → write ______ for each box, keep the sentence, add {lines: 1}
    • a blank coordinate plane → {axes: …} with the plane's range; a blank number line → {numberline: …}; squared paper → {grid: 8}
24. Choices — IXL's clickable answers:
    • buttons or bubbles with one answer → a) b) c) … with {mcq}; "Select all that apply" / several correct → {mcq: multi}; short options (numbers, words) → add {cols: 4} or {cols: 2}
    • "Is it true or false?" / "yes or no" → a) True b) False with {mcq} and {cols: 2}
    • drag-and-drop, sorting into groups, ordering or matching → rewrite for paper: list the items in the question, say what to do in writing (e.g. "Write each number in the correct group: Prime / Composite."), and give {lines: 3}
25. Pictures that can't be typed (fraction bars, models, clocks, shapes, graphs, maps, coins, tables shown as images): [diagram: short description, including every number and label you can see] on its own line where it belongs. A table you can read: copy it as a Markdown table instead.
26. IXL quizzes have no parts. Only add "Part" headings if the material really has sections; keep IXL's question numbers.

EXAMPLE OUTPUT FOR AN IXL QUIZ
Title: Fractions and decimals
Instructions:
- Answer all questions.
- Write your answers in the boxes.
1. Write $\\frac{27}{1{,}000}$ as a decimal number. [1] {lines: 1}
2. Which fraction is equal to $0.4$? [1] {mcq} {cols: 4}
a) $\\frac{4}{100}$
b) $\\frac{2}{5}$
c) $\\frac{1}{4}$
d) $\\frac{40}{1{,}000}$
3. Fill in the missing number: $0.75 = $ ______ $\\div 4$ [1] {lines: 1}
4. What fraction of the shape is shaded? [1] {lines: 1}
[diagram: a rectangle split into 8 equal parts, 3 of them shaded]

Here is the IXL material:
`;
const IXL_AI_PROMPT = USER_AI_PROMPT
  .replace("Convert the exam material I give you (a photo, a PDF, pasted text, or my description of the exam I want)", "Convert the IXL quiz or worksheet I give you (a PDF or screenshots printed from IXL)")
  .split("EXAMPLE OUTPUT")[0] + IXL_RULES;
const PROMPTS = { gen: USER_AI_PROMPT, ixl: IXL_AI_PROMPT };
let promptKind = "gen";
function setPromptKind(k){
  promptKind = PROMPTS[k] ? k : "gen";
  $("#promptText").value = PROMPTS[promptKind];
  document.querySelectorAll("#promptKind button").forEach(b => b.classList.toggle("on", b.dataset.k === promptKind));
  $("#promptFor").textContent = promptKind === "ixl" ? "Attach the PDF printed from IXL (or screenshots of the quiz)." : "Attach your photo/PDF of the exam, or paste the questions, or describe the exam you want.";
}
async function copyPrompt(k, btn){
  const t = PROMPTS[k] || USER_AI_PROMPT;
  try{ await navigator.clipboard.writeText(t); toast((k === "ixl" ? "IXL prompt" : "Prompt") + " copied — paste it into your AI chat"); if(btn){ const o = btn.innerHTML; btn.textContent = "✓ Copied"; setTimeout(() => btn.innerHTML = o, 2200); } return true; }
  catch(e){ document.querySelectorAll(".modal.open").forEach(m => m.classList.remove("open")); openModal("#promptModal"); setPromptKind(k); const ta = $("#promptText"); ta.focus(); ta.select(); toast("Select all and copy the prompt"); return false; }
}
setPromptKind("gen");
document.addEventListener("click", e => { const a = e.target.closest(".open-prompt"); if(a){ e.preventDefault(); document.querySelectorAll(".modal.open").forEach(m => m.classList.remove("open")); setPromptKind(a.dataset.p || "gen"); openModal("#promptModal"); } });
$("#promptKind").addEventListener("click", e => { const b = e.target.closest("[data-k]"); if(b) setPromptKind(b.dataset.k); });
$("#promptCopy").onclick = async () => {
  try{ await navigator.clipboard.writeText(PROMPTS[promptKind]); toast((promptKind === "ixl" ? "IXL prompt" : "Prompt") + " copied — paste it into your AI chat"); }
  catch(e){ const t = $("#promptText"); t.focus(); t.select(); document.execCommand("copy"); toast("Prompt copied"); }
};
$("#promptToPaste").onclick = () => { $("#promptModal").classList.remove("open"); $("#pasteText").click(); };
