import { describe, expect, it } from "vitest";
import { analyzeSite, SIGNAL } from "./analyze";

const NOW = new Date(2026, 8, 30);
const modern = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>x</title></head>
<body><div>ok</div><footer>© 2026 Padaria</footer></body></html>`;

const run = (html: string, over: { finalUrl?: string; lastModified?: string } = {}) =>
  analyzeSite({ html, finalUrl: over.finalUrl ?? "https://padaria.com.br/", lastModified: over.lastModified, now: NOW });

describe("analyzeSite", () => {
  it("site moderno é OK e sem sinais", () => {
    expect(run(modern)).toEqual({ status: "OK", signals: [] });
  });

  it("sem meta viewport já é OLD, com o sinal em português", () => {
    const r = run("<html><head><title>x</title></head><body><div>oi</div></body></html>");
    expect(r.status).toBe("OLD");
    expect(r.signals).toContain("Site sem versão para celular");
  });

  it("um sinal isolado (sem HTTPS) não basta", () => {
    const r = run(modern, { finalUrl: "http://padaria.com.br/" });
    expect(r).toEqual({ status: "OK", signals: [SIGNAL.noHttps] });
  });

  it("dois sinais viram OLD: sem HTTPS + copyright antigo", () => {
    const r = run(modern.replace("© 2026", "© 2015"), { finalUrl: "http://padaria.com.br/" });
    expect(r.status).toBe("OLD");
    expect(r.signals).toHaveLength(2);
    expect(r.signals[1]).toContain("2015");
  });

  it("intervalo de anos no copyright usa o último ano", () => {
    expect(run(modern.replace("© 2026", "© 2010-2025")).signals).toEqual([]);
    expect(run(modern.replace("© 2026", "Copyright 2009 - 2013")).signals).toHaveLength(1);
  });

  it("detecta Flash, frames, font/marquee e layout por tabelas", () => {
    const html = `<html><head><meta name="viewport" content="x"></head><body>
      <embed src="a.swf"><frameset cols="1"></frameset><font size=2>a</font><marquee>b</marquee>
      <table></table><table></table><table></table></body></html>`;
    const r = run(html);
    expect(r.status).toBe("OLD");
    expect(r.signals).toEqual(expect.arrayContaining([SIGNAL.flash, SIGNAL.frames, SIGNAL.oldTags, SIGNAL.tables]));
  });

  it("detecta jQuery 1.x mas não 3.x", () => {
    const head = (src: string) => `<html><head><meta name="viewport" content="x"><script src="${src}"></script></head><body></body></html>`;
    expect(run(head("/js/jquery-1.11.3.min.js")).signals).toEqual([SIGNAL.jquery]);
    expect(run(head("https://code.jquery.com/jquery-3.7.1.min.js")).signals).toEqual([]);
  });

  it("detecta CMS em versão antiga pela meta generator", () => {
    const gen = (c: string) => `<html><head><meta name="viewport" content="x"><meta name="generator" content="${c}"></head></html>`;
    expect(run(gen("WordPress 4.9.8")).signals[0]).toContain("WordPress");
    expect(run(gen("WordPress 6.5")).signals).toEqual([]);
    expect(run(gen("Microsoft FrontPage 4.0")).signals).toHaveLength(1);
  });

  it("Last-Modified com mais de 4 anos é um sinal", () => {
    const r = run(modern, { lastModified: "Fri, 15 Jun 2018 12:00:00 GMT" });
    expect(r.signals).toEqual(["Última modificação em 2018"]);
    expect(run(modern, { lastModified: "Sun, 15 Jun 2025 12:00:00 GMT" }).signals).toEqual([]);
  });
});
