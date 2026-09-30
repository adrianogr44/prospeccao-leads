/** Detecta a plataforma do site pelo HTML. Ordem importa: mais específico primeiro. */

const RULES: Array<{ name: string; test: RegExp }> = [
  { name: "Nuvemshop", test: /nuvemshop|tiendanube|lojavirtualnuvem/i },
  { name: "Loja Integrada", test: /lojaintegrada|awsli\.com\.br/i },
  { name: "Tray", test: /traycdn|cdn\.tray\.com\.br|tray\.com\.br|tcdn\.com\.br/i },
  { name: "Bagy", test: /bagy\.com\.br|cdn\.bagy|dooca\.store|dooca\.com\.br/i },
  { name: "Yampi", test: /yampi\.(?:io|com\.br)|yampi-cdn/i },
  { name: "VTEX", test: /vtexassets|vteximg|vtex\.com|vtexcommerce/i },
  { name: "Shopify", test: /cdn\.shopify\.com|myshopify\.com|Shopify\.theme/i },
  { name: "Wix", test: /wixstatic\.com|static\.parastorage\.com|wix\.com\/|<meta[^>]+generator[^>]+wix/i },
  { name: "Squarespace", test: /squarespace\.com|static1\.squarespace|sqspcdn/i },
  { name: "Webflow", test: /assets\.website-files\.com|cdn\.prod\.website-files\.com|data-wf-(?:page|site)|webflow\.com/i },
  { name: "Blogger", test: /<meta[^>]+generator[^>]+blogger|blogger\.com\/static|blogspot\.com/i },
  { name: "Google Sites", test: /sites\.google\.com|<meta[^>]+generator[^>]+google sites/i },
  { name: "GoDaddy", test: /img1\.wsimg\.com|secureserver\.net|godaddy/i },
  { name: "Hostinger", test: /zyrosite\.com|hostinger/i },
  { name: "Joomla", test: /\/media\/jui\/|<meta[^>]+generator[^>]+joomla|\/components\/com_/i },
  { name: "Drupal", test: /<meta[^>]+generator[^>]+drupal|\/sites\/default\/files|drupal-settings-json/i },
  // Elementor só existe em WordPress
  { name: "WordPress", test: /wp-content|wp-includes|wp-json|<meta[^>]+generator[^>]+wordpress|elementor/i },
];

export function detectPlatform(html: string): string | null {
  return RULES.find((r) => r.test.test(html))?.name ?? null;
}
