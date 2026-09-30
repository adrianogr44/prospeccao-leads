import { describe, expect, it } from "vitest";
import { extractContacts, parseSocialHref, socialUrl } from "./contacts";

describe("extractContacts", () => {
  it("wa.me preenche o WhatsApp com os dígitos", () => {
    expect(extractContacts('<a href="https://wa.me/5511999998888?text=Oi">Fale</a>').whatsapp).toBe("5511999998888");
  });

  it("api.whatsapp.com/send?phone= (com &amp;) também", () => {
    const html = '<a href="https://api.whatsapp.com/send?text=oi&amp;phone=5511999998888">x</a>';
    expect(extractContacts(html).whatsapp).toBe("5511999998888");
  });

  it("sem link explícito, WhatsApp continua vazio mesmo com telefone celular no texto", () => {
    expect(extractContacts("<p>Ligue (11) 99999-8888</p>").whatsapp).toBeUndefined();
    expect(extractContacts('<a href="/contato">Contato</a><a href="https://wa.me/message/ABC123">x</a>').whatsapp).toBeUndefined();
  });

  it("redes sociais: perfil sim, compartilhamento e posts não", () => {
    const html = `
      <a href="https://www.instagram.com/padaria.x/">ig</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=abc">compartilhar</a>
      <a href="https://facebook.com/padariax">fb</a>
      <a href="https://br.linkedin.com/company/padariax">in</a>
      <a href="https://www.tiktok.com/@padariax">tt</a>`;
    expect(extractContacts(html)).toEqual({
      instagram: "https://www.instagram.com/padaria.x",
      facebook: "https://www.facebook.com/padariax",
      linkedin: "https://www.linkedin.com/company/padariax",
      tiktok: "https://www.tiktok.com/@padariax",
    });
    expect(extractContacts('<a href="https://instagram.com/p/Cabc123/">post</a>').instagram).toBeUndefined();
  });

  it("e-mail via mailto, ignorando lixo", () => {
    expect(extractContacts('<a href="mailto:Contato@Padaria.com.br?subject=Oi">e</a>').email).toBe("contato@padaria.com.br");
    expect(extractContacts('<a href="mailto:x@sentry.io">e</a>').email).toBeUndefined();
  });
});

describe("parseSocialHref", () => {
  it("reconhece Instagram, Linktree, WhatsApp e site comum", () => {
    expect(parseSocialHref("https://instagram.com/loja.x")).toEqual({ kind: "instagram", value: "https://www.instagram.com/loja.x" });
    expect(parseSocialHref("linktr.ee/loja")).toEqual({ kind: "other", value: null });
    expect(parseSocialHref("wa.me/5511999998888")).toEqual({ kind: "whatsapp", value: "5511999998888" });
    expect(parseSocialHref("https://minhaloja.com.br")).toBeNull();
    expect(parseSocialHref("mailto:a@b.com")).toBeNull();
    expect(parseSocialHref("/contato")).toBeNull();
  });
});

describe("socialUrl", () => {
  it("monta URL a partir de @usuario ou URL", () => {
    expect(socialUrl("instagram", "@bar_do_ze")).toBe("https://www.instagram.com/bar_do_ze");
    expect(socialUrl("facebook", "https://www.facebook.com/bar")).toBe("https://www.facebook.com/bar");
    expect(socialUrl("instagram", "")).toBeNull();
  });
});
