/**
 * Busca de produtos por palavras-chave: "marlan rn", "body rosa p", "calca 4".
 *
 * - Cada palavra precisa bater em algum lugar: nome, marca, categoria, peça,
 *   público, modelo, cor, tamanho, SKU ou código de barras. A ordem não importa.
 * - Sem diferença entre maiúsculas e acentos ("calca" acha "Calça").
 * - Nos textos, a palavra bate com o começo de uma palavra ("marl" acha Marlan,
 *   "rn" não acha "inverno"). No SKU, com o começo de uma parte (SARJA, CJ-MN).
 * - Tamanho é exato ("4" acha 4 e 04, não 14). Código de barras, inteiro.
 * - Palavra que bate numa cor, tamanho ou SKU de variação escolhe as variações:
 *   "marlan rn" traz os produtos Marlan e, de cada um, só os tamanhos RN.
 *
 * Funções puras. No main (Node) é um módulo; nas telas (<script>) vira window.BuscaProdutos.
 */
(function () {

const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const normalizar = (s) => semAcento(s).toLowerCase().trim();
const tokens = (s) => normalizar(s).split(/[^a-z0-9]+/).filter(Boolean);

// Palavras que não ajudam a achar ("body de menina", "tam 4")
const IGNORAR = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "pra", "tam", "tamanho", "cor", "n", "no", "na"]);

// "Marlan  RN" -> ["marlan", "rn"]. Vírgulas e barras também separam.
function palavrasDaBusca(texto) {
    return normalizar(texto).split(/[\s,;/]+/).map((p) => p.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
        .filter((p) => p && !IGNORAR.has(p));
}

// A palavra é o começo de alguma palavra do texto. Com hífen ("off-white"), vale o trecho.
function bateTexto(palavra, texto) {
    if (!texto) return false;
    if (/[^a-z0-9]/.test(palavra)) return normalizar(texto).includes(palavra);
    // Uma letra só ("m", "p") vale inteira: senão "m" acharia "Manga", "Marlan"...
    if (palavra.length === 1) return tokens(texto).includes(palavra);
    return tokens(texto).some((t) => t.startsWith(palavra));
}

// A palavra é o começo do SKU ou de uma parte dele: "sarja", "cj-mn", "azu-04"
function bateSku(palavra, sku) {
    if (!sku) return false;
    const s = normalizar(sku);
    if (palavra.length === 1) return s.split("-").includes(palavra);
    return s.startsWith(palavra) || s.includes(`-${palavra}`);
}

// Tamanho exato, sem zero à esquerda: "4" = "04"
const semZero = (s) => (/^\d+$/.test(s) ? String(Number(s)) : s);
const bateTamanho = (palavra, tamanho) => !!tamanho && semZero(normalizar(tamanho)) === semZero(palavra);

// Nomes das peças e públicos (vêm do SKU) para achar "bebe" em produtos BB
let SKU = null;
try { SKU = typeof module !== "undefined" && module.exports ? require("./sku.js") : (typeof window !== "undefined" ? window.Sku : null); } catch { SKU = null; }

function textosDoProduto(p) {
    return [p.nome, p.marca, p.categoria, p.codigoModelo,
        SKU && p.tipoPeca ? SKU.PECAS[p.tipoPeca] : null,
        SKU && p.publico ? SKU.PUBLICOS[p.publico] : null];
}

const bateProduto = (palavra, p) => textosDoProduto(p).some((t) => bateTexto(palavra, t)) || bateSku(palavra, p.skuPai);

function bateVariacao(palavra, v) {
    return bateTamanho(palavra, v.tamanho) || bateTexto(palavra, v.cor) || bateSku(palavra, v.sku)
        || (v.skusAnteriores || []).some((s) => bateSku(palavra, s))
        || (!!v.codigoBarras && /^\d{8,}$/.test(palavra) && v.codigoBarras === palavra);
}

/**
 * Variações do produto que atendem a busca, ou null se o produto não atende.
 * Palavra que bate em alguma variação passa a valer só para as variações;
 * a que não bate em nenhuma precisa bater no produto.
 * Com `incluirInativas` false, só as variações ativas contam.
 */
function variacoesQueAtendem(produto, palavras, { incluirInativas = true } = {}) {
    const todas = produto.variacoes || [];
    const variacoes = todas.filter((v) => incluirInativas || v.ativo !== false);
    let restantes = variacoes;
    for (const palavra of palavras) {
        // Conta também as inativas para decidir: "m" é tamanho mesmo se o M está inativo
        const dasVariacoes = todas.filter((v) => bateVariacao(palavra, v));
        if (dasVariacoes.length) restantes = restantes.filter((v) => dasVariacoes.includes(v));
        else if (!bateProduto(palavra, produto)) return null;
        if (!restantes.length) return null;
    }
    // Produto sem variações: vale só o que bateu no produto
    return variacoes.length ? restantes : [];
}

/**
 * Filtra os produtos pela busca. Devolve [{ produto, variacoes, todas }]:
 * `variacoes` são as que atendem e `todas` diz se a busca não escolheu nenhuma.
 */
function filtrar(produtos, texto, opcoes) {
    const palavras = palavrasDaBusca(texto);
    if (!palavras.length) return [];
    const achados = [];
    for (const produto of produtos) {
        const variacoes = variacoesQueAtendem(produto, palavras, opcoes);
        if (!variacoes) continue;
        const total = (produto.variacoes || []).filter((v) => (opcoes && opcoes.incluirInativas === false ? v.ativo !== false : true)).length;
        achados.push({ produto, variacoes, todas: variacoes.length === total });
    }
    return achados;
}

// Para a lista simples da reposição: cada palavra bate em algum dos textos ou SKUs
function atende(texto, { textos = [], skus = [], tamanhos = [] } = {}) {
    const palavras = palavrasDaBusca(texto);
    return palavras.every((p) => textos.some((t) => bateTexto(p, t)) || skus.some((s) => bateSku(p, s))
        || tamanhos.some((t) => bateTamanho(p, t)));
}

// ---- Pré-filtro no banco: pega um pouco a mais, e `filtrar` decide ----
const ACENTOS = {
    a: "aáàâãäAÁÀÂÃÄ", e: "eéèêëEÉÈÊË", i: "iíìîïIÍÌÎÏ", o: "oóòôõöOÓÒÔÕÖ", u: "uúùûüUÚÙÛÜ", c: "cçCÇ", n: "nñNÑ",
};
// "calca" -> c[...]lc[...] que acha "Calça", "CALCA"...
function padraoSemAcento(palavra) {
    return [...palavra].map((ch) => (ACENTOS[ch] ? `[${ACENTOS[ch]}]` : ch.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&"))).join("");
}

function codigosPorNome(palavra, tabela) {
    if (!tabela) return [];
    return Object.keys(tabela).filter((codigo) => bateTexto(palavra, tabela[codigo]));
}

// Filtro do MongoDB: todas as palavras, cada uma em qualquer campo (por trecho)
function filtroDoBanco(texto) {
    const palavras = palavrasDaBusca(texto);
    if (!palavras.length) return null;
    return {
        $and: palavras.map((palavra) => {
            const re = new RegExp(padraoSemAcento(semZero(palavra)), "i");
            const ou = ["nome", "marca", "categoria", "codigoModelo", "skuPai",
                "variacoes.sku", "variacoes.skusAnteriores", "variacoes.cor", "variacoes.tamanho", "variacoes.codigoBarras"]
                .map((campo) => ({ [campo]: re }));
            const pecas = codigosPorNome(palavra, SKU && SKU.PECAS);
            const publicos = codigosPorNome(palavra, SKU && SKU.PUBLICOS);
            if (pecas.length) ou.push({ tipoPeca: { $in: pecas } });
            if (publicos.length) ou.push({ publico: { $in: publicos } });
            return { $or: ou };
        }),
    };
}

const API = { palavrasDaBusca, variacoesQueAtendem, filtrar, atende, filtroDoBanco, normalizar };
if (typeof module !== "undefined" && module.exports) module.exports = API;
if (typeof window !== "undefined") window.BuscaProdutos = API;
})();
