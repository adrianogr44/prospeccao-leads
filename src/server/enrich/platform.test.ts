import { describe, expect, it } from "vitest";
import { detectPlatform } from "./platform";

describe("detectPlatform", () => {
  it.each([
    ['<link href="/wp-content/themes/x/style.css">', "WordPress"],
    ['<div class="elementor-section"></div>', "WordPress"],
    ['<script src="https://cdn.shopify.com/s/files/app.js"></script>', "Shopify"],
    ['<img src="https://static.wixstatic.com/media/a.jpg">', "Wix"],
    ['<link href="https://static1.squarespace.com/x.css">', "Squarespace"],
    ['<html data-wf-page="1" data-wf-site="2">', "Webflow"],
    ['<script src="https://cdn.awsli.com.br/x.js"></script>', "Loja Integrada"],
    ['<script src="https://acdn.nuvemshop.com.br/x.js"></script>', "Nuvemshop"],
    ['<img src="https://images.tcdn.com.br/img/x.png">', "Tray"],
    ['<script src="//io.vtexassets.com/x.js"></script>', "VTEX"],
    ['<meta name="generator" content="Joomla! - Open Source">', "Joomla"],
    ['<meta name="generator" content="Drupal 10">', "Drupal"],
  ])("%s -> %s", (html, expected) => {
    expect(detectPlatform(html)).toBe(expected);
  });

  it("plataforma de e-commerce vence WordPress quando ambos aparecem", () => {
    expect(detectPlatform('<script src="https://cdn.shopify.com/a.js"></script><link href="/wp-content/x.css">')).toBe("Shopify");
  });

  it("sem pistas devolve null", () => {
    expect(detectPlatform("<html><body>site feito à mão</body></html>")).toBeNull();
  });
});
