/**
 * Protótipo navegável do catálogo digital Y&B.
 * Usa uma cópia dos produtos reais (dados.js). Nada é gravado: a sacola fica no
 * navegador e o "pedido" só existe nesta tela, para ver o fluxo e a mensagem do WhatsApp.
 */
(function () {
const PRODUTOS = window.PRODUTOS || [];
const WHATSAPP_LOJA = "5511992087036";
const $ = (id) => document.getElementById(id);
const conteudo = $("conteudo");

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moeda = (v) => formatoMoeda.format(Number(v) || 0);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Foto no tamanho certo (Shopee: _tn é a miniatura; Cloudinary: tamanho na URL)
function foto(url, pequena) {
    if (!url) return "";
    if (pequena && /img\.susercontent\.com\/file\/[^/_]+$/.test(url)) return `${url}_tn`;
    if (/res\.cloudinary\.com\/.+\/upload\//.test(url)) return url.replace("/upload/", `/upload/c_fill,w_${pequena ? 500 : 1000},h_${pequena ? 625 : 1250},f_auto,q_auto/`);
    return url;
}
const porId = new Map(PRODUTOS.map((p) => [p.id, p]));
const estoqueDe = (p) => p.variacoes.reduce((s, v) => s + v.estoque, 0);
const precoMinimo = (p) => Math.min(...p.variacoes.map((v) => v.preco));
const coresDe = (p) => [...new Set(p.variacoes.map((v) => v.cor).filter(Boolean))];
const novidades = PRODUTOS.slice().sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
const NOVOS = new Set(novidades.slice(0, 12).map((p) => p.id));

const CATEGORIAS = {
    todos: { nome: "Tudo", frase: "Todas as peças da loja" },
    BB: { nome: "Bebê", frase: "Do RN ao GB, com toque macio", cor: "var(--blush)", publicos: ["BB"] },
    MA: { nome: "Menina", frase: "Conjuntos, vestidos e mais", cor: "var(--lavanda)", publicos: ["MA"] },
    MN: { nome: "Menino", frase: "Para brincar o dia todo", cor: "var(--ceu)", publicos: ["MN"] },
    IN: { nome: "Infantil", frase: "Peças para todos", cor: "var(--salvia)", publicos: ["IN", "UN"] },
    FE: { nome: "Feminino", frase: "Moda para a família", cor: "var(--baunilha)", publicos: ["FE"] },
    MS: { nome: "Masculino", frase: "Moda para a família", cor: "var(--salvia)", publicos: ["MS"] },
};
const PECAS = [
    ["", "Todas as peças"], ["CJ", "Conjuntos"], ["VE", "Vestidos"], ["CA", "Calças"], ["SH", "Shorts"],
    ["CM,PO,RE", "Camisetas"], ["BL", "Blusas"], ["JQ", "Jaquetas"], ["PJ", "Pijamas"], ["KI", "Kits"],
    ["TE,SD,BT", "Calçados"], ["EN", "Enxoval"],
];

// Cor do nome ("Azul marinho" -> tom), para as bolinhas de cor
const TONS = [
    [/marinho/, "#1F2A44"], [/azul/, "#7FA7D6"], [/rosa|pink/, "#EDB5C3"], [/vermelh/, "#C0392B"], [/vinho|bord/, "#6E1F2C"],
    [/verde|militar|salvia/, "#7E9B76"], [/amarel|mostarda/, "#E9C46A"], [/laranja|coral/, "#E98A5B"], [/lil[aá]s|lavanda/, "#C3B1E1"],
    [/roxo|uva/, "#6B3FA0"], [/preto|preta/, "#1A1A1A"], [/branc|off/, "#FBFAF7"], [/cinza|mescla/, "#B9B6B1"], [/bege|nude|areia|cru/, "#E3D3BD"],
    [/marrom|caramelo|chocolate|camel/, "#8A5A3B"], [/jeans/, "#5C7FA6"], [/dourad/, "#C9A14A"],
];
function tom(cor) {
    const c = String(cor || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const achado = TONS.find(([re]) => re.test(c));
    return achado ? achado[1] : "linear-gradient(135deg, #EDB5C3, #7FA7D6 50%, #E9C46A)";
}

// ---------- Sacola ----------
const sacola = {
    ler: () => JSON.parse(localStorage.getItem("yb.sacola") || "[]"),
    gravar: (itens) => { localStorage.setItem("yb.sacola", JSON.stringify(itens)); atualizarContador(); },
};
function itensDaSacola() {
    return sacola.ler().map((i) => {
        const p = porId.get(i.produtoId);
        const v = p && p.variacoes.find((x) => x.id === i.variacaoId);
        return p && v ? { ...i, produto: p, variacao: v, quantidade: Math.min(i.quantidade, v.estoque) } : null;
    }).filter((i) => i && i.quantidade > 0);
}
function atualizarContador() {
    const n = sacola.ler().reduce((s, i) => s + i.quantidade, 0);
    $("contadorSacola").hidden = n === 0;
    $("contadorSacola").textContent = n;
}
const totais = (itens) => itens.reduce((s, i) => s + i.quantidade * i.variacao.preco, 0);
const pecas = (itens) => itens.reduce((s, i) => s + i.quantidade, 0);

// ---------- Carrossel: arrasta com o dedo (scroll-snap), setas no computador ----------
function carrossel(fotos, { pequena = false, contagem = false, alt = "" } = {}) {
    const lista = fotos.length ? fotos : [""];
    return `<div class="carrossel">
        <div class="carrossel-faixa">${lista.map((f, i) => `<img src="${esc(foto(f, pequena))}" alt="${i === 0 ? esc(alt) : ""}" loading="${i === 0 ? "eager" : "lazy"}" draggable="false" />`).join("")}</div>
        ${lista.length > 1 ? `
            <button type="button" class="carrossel-seta esq" aria-label="Foto anterior">‹</button>
            <button type="button" class="carrossel-seta dir" aria-label="Próxima foto">›</button>
            ${contagem ? `<span class="carrossel-contagem">1 / ${lista.length}</span>` : `<div class="carrossel-pontos">${lista.map((_, i) => `<i class="${i ? "" : "ativo"}"></i>`).join("")}</div>`}` : ""}
    </div>`;
}
function ativarCarrosseis(raiz, aoMudar) {
    raiz.querySelectorAll(".carrossel").forEach((c) => {
        const faixa = c.querySelector(".carrossel-faixa");
        const total = faixa.children.length;
        const atual = () => Math.round(faixa.scrollLeft / faixa.clientWidth);
        const ir = (i) => faixa.scrollTo({ left: Math.max(0, Math.min(total - 1, i)) * faixa.clientWidth, behavior: "smooth" });
        c.querySelectorAll(".carrossel-seta").forEach((s) => s.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            ir(atual() + (s.classList.contains("dir") ? 1 : -1));
        }));
        let quadro = null;
        faixa.addEventListener("scroll", () => {
            cancelAnimationFrame(quadro);
            quadro = requestAnimationFrame(() => {
                const i = atual();
                c.querySelectorAll(".carrossel-pontos i").forEach((p, k) => p.classList.toggle("ativo", k === i));
                const cont = c.querySelector(".carrossel-contagem");
                if (cont) cont.textContent = `${i + 1} / ${total}`;
                if (aoMudar) aoMudar(i);
            });
        }, { passive: true });
        c.irPara = ir;
    });
}

// ---------- Cartão de produto ----------
function cartao(p) {
    const estoque = estoqueDe(p);
    const cores = coresDe(p);
    const etiqueta = estoque <= 0 ? `<span class="card-etiqueta alerta">Esgotado</span>`
        : estoque <= 2 ? `<span class="card-etiqueta alerta">Últimas unidades</span>`
        : NOVOS.has(p.id) ? `<span class="card-etiqueta">Novo</span>` : `<span class="card-etiqueta"></span>`;
    return `<a class="card${estoque <= 0 ? " esgotado" : ""}" href="#/p/${p.id}">
        <div class="card-fotos">${carrossel(p.fotos.slice(0, 5), { pequena: true, alt: p.nome })}</div>
        <div class="card-info">
            ${etiqueta}
            <span class="card-nome">${esc(p.nome)}</span>
            <span class="card-preco">${moeda(precoMinimo(p))}</span>
            ${cores.length > 1 ? `<span class="card-cores">${cores.slice(0, 5).map((c) => `<i style="display:inline-block;width:10px;height:10px;border-radius:50%;border:1px solid rgba(0,0,0,.12);background:${tom(c)}"></i>`).join("")} ${cores.length} cores</span>` : ""}
        </div>
    </a>`;
}

// ---------- Início ----------
function telaInicio() {
    // Capa e blocos: de preferência fotos de estúdio (as originais da pasta, com modelo)
    const comFoto = (lista) => {
        const boas = lista.filter((p) => p.fotos.length > 1 && estoqueDe(p) > 0);
        return [...boas.filter((p) => p.fotos[0].startsWith("fotos/")), ...boas.filter((p) => !p.fotos[0].startsWith("fotos/"))];
    };
    const destaque = comFoto(novidades.filter((p) => ["MA", "BB"].includes(p.publico)))[0] || novidades[0];
    const capaCategoria = (id) => (comFoto(novidades.filter((p) => p.id !== destaque.id && CATEGORIAS[id].publicos.includes(p.publico)))[0] || {}).fotos?.[0] || "";
    const blocos = ["BB", "MA", "MN", "FE"];
    conteudo.innerHTML = `
        <section class="capa">
            <a class="capa-foto" href="#/p/${destaque.id}"><img src="${esc(foto(destaque.fotos[0]))}" alt="${esc(destaque.nome)}" /></a>
            <div class="capa-texto">
                <span class="sobretitulo">Coleção Y&amp;B</span>
                <h1>Pequenos <em>grandes</em> momentos</h1>
                <p>Peças escolhidas com carinho, do bebê à família. Monte seu pedido aqui e finalize pelo WhatsApp.</p>
                <a class="botao" href="#/c/todos">Ver a coleção</a>
            </div>
        </section>

        <section class="secao">
            <div class="secao-titulo"><div><span class="sobretitulo">Compre por</span><h2>Para cada fase</h2></div></div>
            <div class="blocos">${blocos.map((id) => `
                <a class="bloco-cat" href="#/c/${id}" style="background:${CATEGORIAS[id].cor}">
                    ${capaCategoria(id) ? `<img src="${esc(foto(capaCategoria(id), true))}" alt="" loading="lazy" />` : ""}
                    <span>${CATEGORIAS[id].nome}<small>${CATEGORIAS[id].frase}</small></span>
                </a>`).join("")}</div>
        </section>

        <section class="secao">
            <div class="secao-titulo"><div><span class="sobretitulo">Acabou de chegar</span><h2>Novidades</h2></div><a class="link-seta" href="#/c/todos">Ver tudo</a></div>
            <div class="trilho">${novidades.filter((p) => estoqueDe(p) > 0).slice(0, 10).map(cartao).join("")}</div>
        </section>

        <section class="secao">
            <div class="secao-titulo"><div><span class="sobretitulo">Para os pequenos</span><h2>Bebê</h2></div><a class="link-seta" href="#/c/BB">Ver tudo</a></div>
            <div class="grade">${novidades.filter((p) => p.publico === "BB" && estoqueDe(p) > 0).slice(0, 8).map(cartao).join("")}</div>
        </section>`;
    ativarCarrosseis(conteudo);
}

// ---------- Lista: categoria ou busca ----------
const filtros = { peca: "", ordem: "novidades", esgotados: false };
function telaLista(categoria, busca) {
    const cat = CATEGORIAS[categoria] || CATEGORIAS.todos;
    let lista = busca && window.BuscaProdutos ? window.BuscaProdutos.filtrar(PRODUTOS, busca).map((a) => a.produto) : PRODUTOS.slice();
    if (!busca && cat.publicos) lista = lista.filter((p) => cat.publicos.includes(p.publico));
    const pecasDaLista = new Set(lista.map((p) => p.peca));
    if (filtros.peca) lista = lista.filter((p) => filtros.peca.split(",").includes(p.peca));
    const esgotados = lista.filter((p) => estoqueDe(p) <= 0).length;
    if (!filtros.esgotados) lista = lista.filter((p) => estoqueDe(p) > 0);
    const ordens = {
        novidades: (a, b) => new Date(b.criadoEm) - new Date(a.criadoEm),
        menor: (a, b) => precoMinimo(a) - precoMinimo(b),
        maior: (a, b) => precoMinimo(b) - precoMinimo(a),
    };
    lista.sort(ordens[filtros.ordem]);
    const pecasVisiveis = PECAS.filter(([id]) => !id || id.split(",").some((x) => pecasDaLista.has(x)));

    conteudo.innerHTML = `
        <div class="lista-topo">
            <span class="sobretitulo">${busca ? "Busca" : "Y&amp;B Moda Kids"}</span>
            <h1>${busca ? `“${esc(busca)}”` : cat.nome}</h1>
            <p>${lista.length} ${lista.length === 1 ? "peça" : "peças"}${busca ? "" : " · " + esc(cat.frase)}</p>
        </div>
        <div class="filtros"><div class="filtros-conteudo">
            ${pecasVisiveis.map(([id, nome]) => `<button type="button" class="pilula" data-peca="${id}" aria-pressed="${filtros.peca === id}">${nome}</button>`).join("")}
            <span class="divisor"></span>
            <select id="selOrdem" aria-label="Ordenar">
                <option value="novidades" ${filtros.ordem === "novidades" ? "selected" : ""}>Novidades</option>
                <option value="menor" ${filtros.ordem === "menor" ? "selected" : ""}>Menor preço</option>
                <option value="maior" ${filtros.ordem === "maior" ? "selected" : ""}>Maior preço</option>
            </select>
            <label><input type="checkbox" id="chkEsgotados" ${filtros.esgotados ? "checked" : ""} /> Mostrar esgotados${esgotados ? ` (${esgotados})` : ""}</label>
        </div></div>
        <section class="secao" style="padding-top:28px">
            ${lista.length ? `<div class="grade">${lista.map(cartao).join("")}</div>`
                : `<div class="vazio"><h2>Nada por aqui</h2><p>Tente outra palavra, ou fale com a loja no WhatsApp: a gente ajuda a encontrar.</p></div>`}
        </section>`;
    ativarCarrosseis(conteudo);
    conteudo.querySelectorAll("[data-peca]").forEach((b) => b.addEventListener("click", () => { filtros.peca = b.dataset.peca; telaLista(categoria, busca); }));
    $("selOrdem").addEventListener("change", (e) => { filtros.ordem = e.target.value; telaLista(categoria, busca); });
    $("chkEsgotados").addEventListener("change", (e) => { filtros.esgotados = e.target.checked; telaLista(categoria, busca); });
}

// ---------- Produto ----------
function telaProduto(id) {
    const p = porId.get(id);
    if (!p) return telaNaoEncontrada();
    const cores = coresDe(p);
    const tamanhos = [...new Set(p.variacoes.map((v) => v.tamanho))];
    const temEstoque = (cor, tam) => p.variacoes.some((v) => (!cores.length || v.cor === cor) && v.tamanho === tam && v.estoque > 0);
    const estado = {
        cor: cores.find((c) => p.variacoes.some((v) => v.cor === c && v.estoque > 0)) || cores[0] || "",
        tamanho: "",
        quantidade: 1,
    };
    const variacao = () => p.variacoes.find((v) => (!cores.length || v.cor === estado.cor) && v.tamanho === estado.tamanho);
    const fotosDaCor = () => [...new Set([...p.fotosPorCor.filter((f) => f.cor === estado.cor).map((f) => f.url), ...p.fotos])];
    const cat = CATEGORIAS[p.publico === "UN" ? "IN" : p.publico] || CATEGORIAS.todos;
    const parecidos = novidades.filter((x) => x.id !== p.id && x.publico === p.publico && estoqueDe(x) > 0).slice(0, 8);
    const textoDuvida = `Olá, Y&B! Tenho uma dúvida sobre: ${p.nome} (${p.skuPai}).`;

    function desenharGaleria() {
        const fotos = fotosDaCor();
        $("galeria").innerHTML = carrossel(fotos, { contagem: true, alt: p.nome });
        $("miniaturas").innerHTML = fotos.length > 1 ? fotos.map((f, i) => `<button type="button" data-mini="${i}" aria-current="${i === 0}" aria-label="Foto ${i + 1}"><img src="${esc(foto(f, true))}" alt="" loading="lazy" /></button>`).join("") : "";
        ativarCarrosseis($("galeria"), (i) => $("miniaturas").querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-current", String(k === i))));
        $("miniaturas").querySelectorAll("[data-mini]").forEach((b) => b.addEventListener("click", () => $("galeria").querySelector(".carrossel").irPara(Number(b.dataset.mini))));
    }

    function desenharOpcoes() {
        const v = variacao();
        const max = v ? v.estoque : 0;
        if (estado.quantidade > Math.max(1, max)) estado.quantidade = Math.max(1, max);
        $("opcoes").innerHTML = `
            ${cores.length ? `<div class="opcao-grupo">
                <div class="opcao-rotulo">Cor <b>${esc(estado.cor)}</b></div>
                <div class="amostras">${cores.map((c) => `<button type="button" class="amostra" data-cor="${esc(c)}" aria-pressed="${c === estado.cor}" aria-label="${esc(c)}" title="${esc(c)}" ${tamanhos.some((t) => temEstoque(c, t)) ? "" : "disabled"}><i style="background:${tom(c)}"></i></button>`).join("")}</div>
            </div>` : ""}
            <div class="opcao-grupo">
                <div class="opcao-rotulo">Tamanho ${p.tabelaMedidas ? `<a class="link-sublinhado" href="${esc(p.tabelaMedidas)}" target="_blank" rel="noopener">Guia de medidas</a>` : `<b>${estado.tamanho ? esc(estado.tamanho) : ""}</b>`}</div>
                <div class="tamanhos">${tamanhos.map((t) => `<button type="button" class="tamanho" data-tamanho="${esc(t)}" aria-pressed="${t === estado.tamanho}" ${temEstoque(estado.cor, t) ? "" : "disabled"}>${esc(t)}</button>`).join("")}</div>
                <div class="estoque-aviso">${v && max <= 2 ? `Últimas unidades neste tamanho` : ""}</div>
            </div>
            <div class="acoes barra-compra">
                <div class="linha-compra">
                    <div class="quantidade">
                        <button type="button" id="menos" aria-label="Menos" ${estado.quantidade <= 1 ? "disabled" : ""}>−</button>
                        <output>${estado.quantidade}</output>
                        <button type="button" id="mais" aria-label="Mais" ${!v || estado.quantidade >= max ? "disabled" : ""}>+</button>
                    </div>
                    <button type="button" id="btnAdicionar" class="botao" ${v && max > 0 ? "" : "disabled"}>${v ? "Adicionar à sacola" : "Escolha o tamanho"}</button>
                </div>
            </div>
            <a class="botao botao-whats largo" target="_blank" rel="noopener" href="https://wa.me/${WHATSAPP_LOJA}?text=${encodeURIComponent(textoDuvida)}">${iconeWhats} Dúvidas? Fale com a loja</a>`;

        $("opcoes").querySelectorAll("[data-cor]").forEach((b) => b.addEventListener("click", () => {
            estado.cor = b.dataset.cor;
            if (estado.tamanho && !temEstoque(estado.cor, estado.tamanho)) estado.tamanho = "";
            desenharOpcoes();
            desenharGaleria();
        }));
        $("opcoes").querySelectorAll("[data-tamanho]").forEach((b) => b.addEventListener("click", () => { estado.tamanho = b.dataset.tamanho; desenharOpcoes(); }));
        $("menos").addEventListener("click", () => { estado.quantidade--; desenharOpcoes(); });
        $("mais").addEventListener("click", () => { estado.quantidade++; desenharOpcoes(); });
        $("btnAdicionar").addEventListener("click", () => {
            const v = variacao();
            if (!v) return;
            const itens = sacola.ler();
            const existente = itens.find((i) => i.variacaoId === v.id);
            if (existente) existente.quantidade = Math.min(v.estoque, existente.quantidade + estado.quantidade);
            else itens.push({ produtoId: p.id, variacaoId: v.id, quantidade: estado.quantidade });
            sacola.gravar(itens);
            mostrarAdicionado(p, v, estado.quantidade, fotosDaCor()[0]);
        });
    }

    conteudo.innerHTML = `
        <article class="produto">
            <div>
                <div id="galeria" class="produto-galeria"></div>
                <div id="miniaturas" class="miniaturas"></div>
            </div>
            <div class="produto-info">
                <div class="migalha"><a href="#/">Início</a> / <a href="#/c/${p.publico === "UN" ? "IN" : p.publico}">${esc(cat.nome)}</a></div>
                <span class="sobretitulo">${esc(p.marca)}</span>
                <h1>${esc(p.nome)}</h1>
                <div class="produto-preco">${moeda(precoMinimo(p))}</div>
                <div class="produto-pagamento">Pix, dinheiro ou cartão na retirada</div>
                <div id="opcoes"></div>
                <div class="sanfona">
                    ${p.descricao ? `<details open><summary>Descrição</summary><div class="texto">${esc(p.descricao)}</div></details>` : ""}
                    <details><summary>Retirada e entrega</summary><div class="texto">Retire na loja sem custo: avisamos pelo WhatsApp quando o pedido estiver separado.
Prefere receber em casa? Enviamos por Uber ou 99; a corrida é combinada com você e o pagamento é por Pix antecipado.</div></details>
                    <details><summary>Trocas</summary><div class="texto">Trocas na loja, com a etiqueta e a nota. Fale com a gente pelo WhatsApp para combinar.</div></details>
                    <details><summary>Código do produto</summary><div class="texto sku">${esc(p.skuPai)}</div></details>
                </div>
            </div>
        </article>
        ${parecidos.length ? `<section class="secao">
            <div class="secao-titulo"><div><span class="sobretitulo">Combina com</span><h2>Você também pode gostar</h2></div></div>
            <div class="trilho">${parecidos.map(cartao).join("")}</div>
        </section>` : ""}`;
    desenharGaleria();
    desenharOpcoes();
    ativarCarrosseis(conteudo.querySelector(".secao") || document.createElement("div"));
}

function mostrarAdicionado(p, v, quantidade, fotoUrl) {
    const itens = itensDaSacola();
    $("gavetaSacolaConteudo").innerHTML = `
        <div class="adicionado">
            <img src="${esc(foto(fotoUrl, true))}" alt="" />
            <div><div class="item-nome">${esc(p.nome)}</div>
            <div class="item-detalhe">${esc([v.tamanho, v.cor].filter(Boolean).join(" · "))} · ${quantidade} un.</div>
            <div class="item-detalhe" style="color:var(--tinta);margin-top:8px">${moeda(v.preco * quantidade)}</div></div>
        </div>
        <div class="resumo-linha"><span>Na sacola: ${pecas(itens)} ${pecas(itens) === 1 ? "peça" : "peças"}</span><span>${moeda(totais(itens))}</span></div>
        <div class="acoes"><a class="botao largo" href="#/sacola" data-fechar>Ver sacola</a><button type="button" class="botao botao-claro largo" data-fechar>Continuar escolhendo</button></div>`;
    abrirGaveta("gavetaSacola");
}

// ---------- Sacola ----------
function telaSacola() {
    const itens = itensDaSacola();
    if (!itens.length) {
        conteudo.innerHTML = `<div class="pagina"><span class="sobretitulo">Sua seleção</span><h1 class="pagina-titulo">Sacola</h1>
            <div class="vazio"><h2>Sua sacola está vazia</h2><p>Que tal começar pelas novidades?</p><br><a class="botao" href="#/c/todos">Ver a coleção</a></div></div>`;
        return;
    }
    conteudo.innerHTML = `<div class="pagina"><span class="sobretitulo">Sua seleção</span><h1 class="pagina-titulo">Sacola</h1>
        <div class="colunas">
            <section>${itens.map((i) => `<div class="item">
                <a href="#/p/${i.produto.id}"><img src="${esc(foto(i.produto.fotos[0], true))}" alt="" /></a>
                <div>
                    <div class="item-nome">${esc(i.produto.nome)}</div>
                    <div class="item-detalhe">${esc([i.variacao.tamanho, i.variacao.cor].filter(Boolean).join(" · "))}</div>
                    <div class="item-detalhe sku">${esc(i.variacao.sku)}</div>
                    <div class="item-linha">
                        <div class="quantidade">
                            <button type="button" data-menos="${i.variacaoId}" aria-label="Menos">−</button>
                            <output>${i.quantidade}</output>
                            <button type="button" data-mais="${i.variacaoId}" aria-label="Mais" ${i.quantidade >= i.variacao.estoque ? "disabled" : ""}>+</button>
                        </div>
                        <span>${moeda(i.quantidade * i.variacao.preco)}</span>
                    </div>
                    <button type="button" class="remover" data-remover="${i.variacaoId}">Remover</button>
                </div>
            </div>`).join("")}</section>
            <aside class="resumo">
                <h2>Resumo</h2>
                <div class="resumo-linha"><span>${pecas(itens)} ${pecas(itens) === 1 ? "peça" : "peças"}</span><span>${moeda(totais(itens))}</span></div>
                <div class="resumo-linha"><span>Entrega</span><span>Retirada grátis</span></div>
                <div class="resumo-linha total"><span>Total</span><span>${moeda(totais(itens))}</span></div>
                <p class="nota">Por Uber ou 99, a corrida é combinada pelo WhatsApp e não entra neste total.</p>
                <div class="acoes"><a class="botao largo" href="#/finalizar">Finalizar pedido</a><a class="botao botao-claro largo" href="#/c/todos">Continuar escolhendo</a></div>
            </aside>
        </div></div>`;
    const mudar = (id, delta) => {
        sacola.gravar(sacola.ler().map((i) => (i.variacaoId === id ? { ...i, quantidade: i.quantidade + delta } : i)).filter((i) => i.quantidade > 0));
        telaSacola();
    };
    conteudo.querySelectorAll("[data-menos]").forEach((b) => b.addEventListener("click", () => mudar(b.dataset.menos, -1)));
    conteudo.querySelectorAll("[data-mais]").forEach((b) => b.addEventListener("click", () => mudar(b.dataset.mais, +1)));
    conteudo.querySelectorAll("[data-remover]").forEach((b) => b.addEventListener("click", () => mudar(b.dataset.remover, -Infinity)));
}

// ---------- Finalizar ----------
const PAGAMENTOS = {
    pix: ["Pix", "A chave vem pelo WhatsApp da loja"],
    dinheiro: ["Dinheiro", "Na retirada"],
    debito: ["Cartão de débito", "Na retirada"],
    credito: ["Cartão de crédito", "Na retirada"],
};
const ENTREGAS = {
    retirada: ["Retirar na loja", "Sem custo. Avisamos quando estiver separado."],
    aplicativo: ["Receber por Uber ou 99", "A corrida é combinada pelo WhatsApp. Pagamento por Pix antecipado."],
};
function mascaraWhats(valor) {
    const d = valor.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function telaFinalizar() {
    const itens = itensDaSacola();
    if (!itens.length) { location.hash = "#/sacola"; return; }
    const dados = JSON.parse(sessionStorage.getItem("yb.dados") || "{}");
    const estado = { entrega: dados.entrega || "retirada", pagamento: dados.pagamento || "pix" };
    const pagamentosValidos = () => (estado.entrega === "aplicativo" ? ["pix"] : Object.keys(PAGAMENTOS));

    function desenhar() {
        if (!pagamentosValidos().includes(estado.pagamento)) estado.pagamento = "pix";
        conteudo.innerHTML = `<div class="pagina"><span class="sobretitulo">Quase lá</span><h1 class="pagina-titulo">Finalizar pedido</h1>
        <form id="formPedido" class="colunas" novalidate>
            <section>
                <div class="etapa-form"><h2><span>01</span> Seus dados</h2>
                    <div class="campo"><label for="nome">Nome</label><input id="nome" autocomplete="name" value="${esc(dados.nome || "")}" /></div>
                    <div class="campo"><label for="whats">WhatsApp</label><input id="whats" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-9999" value="${esc(dados.whats || "")}" /></div>
                </div>
                <div class="etapa-form"><h2><span>02</span> Entrega</h2>
                    <div class="escolhas">${Object.entries(ENTREGAS).map(([id, [nome, ajuda]]) => `
                        <label class="escolha"><input type="radio" name="entrega" value="${id}" ${estado.entrega === id ? "checked" : ""} /><span><b>${nome}</b><small>${ajuda}</small></span></label>`).join("")}</div>
                    ${estado.entrega === "aplicativo" ? `<br><div class="campo"><label for="endereco">Endereço para entrega</label><textarea id="endereco" autocomplete="street-address" placeholder="Rua, número, complemento, bairro e cidade">${esc(dados.endereco || "")}</textarea></div>` : ""}
                </div>
                <div class="etapa-form"><h2><span>03</span> Pagamento</h2>
                    <div class="escolhas">${pagamentosValidos().map((id) => `
                        <label class="escolha"><input type="radio" name="pagamento" value="${id}" ${estado.pagamento === id ? "checked" : ""} /><span><b>${PAGAMENTOS[id][0]}</b><small>${estado.entrega === "aplicativo" ? "Antes de chamarmos o carro" : PAGAMENTOS[id][1]}</small></span></label>`).join("")}</div>
                    <br><div class="campo"><label for="obs">Observação (opcional)</label><textarea id="obs" placeholder="Ex.: é para presente">${esc(dados.obs || "")}</textarea></div>
                </div>
            </section>
            <aside class="resumo">
                <h2>Seu pedido</h2>
                ${itens.map((i) => `<div class="resumo-linha"><span>${i.quantidade}× ${esc(i.produto.nome)}<br><small style="color:var(--cinza)">${esc([i.variacao.tamanho, i.variacao.cor].filter(Boolean).join(" · "))}</small></span><span>${moeda(i.quantidade * i.variacao.preco)}</span></div>`).join("")}
                <div class="resumo-linha total"><span>Total</span><span>${moeda(totais(itens))}</span></div>
                ${estado.entrega === "aplicativo" ? `<p class="nota">+ corrida do Uber ou 99, combinada pelo WhatsApp.</p>` : ""}
                <label class="aceite"><input type="checkbox" id="aceite" ${dados.aceite ? "checked" : ""} /><span>Concordo que a Y&amp;B use meu nome, WhatsApp e endereço só para atender este pedido.</span></label>
                <p id="erroForm" class="erro" hidden></p>
                <button type="submit" class="botao largo">Confirmar pedido</button>
            </aside>
        </form></div>`;

        const guardar = () => sessionStorage.setItem("yb.dados", JSON.stringify(Object.assign(dados, {
            nome: $("nome").value, whats: $("whats").value, endereco: $("endereco") ? $("endereco").value : dados.endereco,
            obs: $("obs").value, aceite: $("aceite").checked, entrega: estado.entrega, pagamento: estado.pagamento,
        })));
        $("whats").addEventListener("input", (e) => { e.target.value = mascaraWhats(e.target.value); });
        conteudo.querySelectorAll("input[name=entrega]").forEach((r) => r.addEventListener("change", () => { guardar(); estado.entrega = r.value; dados.entrega = r.value; desenhar(); }));
        conteudo.querySelectorAll("input[name=pagamento]").forEach((r) => r.addEventListener("change", () => { estado.pagamento = r.value; }));
        $("formPedido").addEventListener("input", guardar);
        $("formPedido").addEventListener("submit", (e) => {
            e.preventDefault();
            guardar();
            const erro = (texto, campo) => { $("erroForm").textContent = texto; $("erroForm").hidden = false; if (campo) $(campo).focus(); };
            if ($("nome").value.trim().length < 2) return erro("Informe seu nome.", "nome");
            if ($("whats").value.replace(/\D/g, "").length < 10) return erro("Informe um WhatsApp com DDD.", "whats");
            if (estado.entrega === "aplicativo" && $("endereco").value.trim().length < 8) return erro("Informe o endereço para a entrega.", "endereco");
            if (!$("aceite").checked) return erro("Para continuar, marque a concordância.", "aceite");
            criarPedido(itens, {
                nome: $("nome").value.trim(), whats: $("whats").value, entrega: estado.entrega, pagamento: estado.pagamento,
                endereco: $("endereco") ? $("endereco").value.trim() : "", obs: $("obs").value.trim(),
            });
        });
    }
    desenhar();
}

function criarPedido(itens, cliente) {
    // No catálogo de verdade o servidor grava o pedido e devolve o número; aqui é só um contador local
    const n = Number(localStorage.getItem("yb.contador") || 0) + 1;
    localStorage.setItem("yb.contador", String(n));
    sessionStorage.setItem("yb.pedido", JSON.stringify({
        numero: `C-${String(n).padStart(4, "0")}`,
        criadoEm: new Date().toISOString(),
        cliente,
        itens: itens.map((i) => ({ nome: i.produto.nome, sku: i.variacao.sku, tamanho: i.variacao.tamanho, cor: i.variacao.cor, quantidade: i.quantidade, preco: i.variacao.preco })),
        total: totais(itens),
    }));
    sacola.gravar([]);
    location.hash = "#/pedido";
}

// ---------- Mensagem e confirmação ----------
const iconeWhats = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.6-.3z"/></svg>`;

function mensagemWhatsApp(p) {
    const data = new Date(p.criadoEm);
    const quando = `${data.toLocaleDateString("pt-BR")} ${data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    const app = p.cliente.entrega === "aplicativo";
    const linhas = [
        "⚠️ TESTE DO PROTÓTIPO DO CATÁLOGO (não é um pedido de verdade)",
        "",
        "Olá, Y&B Moda Kids! 👋",
        "Fiz um pedido pelo catálogo digital.",
        "",
        `🧾 Pedido ${p.numero} · ${quando}`,
        `👤 ${p.cliente.nome} · ${p.cliente.whats}`,
        "",
        ...p.itens.flatMap((i, k) => [
            `${k + 1}) ${i.nome}`,
            `   SKU ${i.sku} · ${[i.tamanho, i.cor].filter(Boolean).join(" · ")}`,
            `   ${i.quantidade} × ${moeda(i.preco)} = ${moeda(i.quantidade * i.preco)}`,
        ]),
        "",
        `Itens: ${p.itens.reduce((s, i) => s + i.quantidade, 0)} peça(s) · ${moeda(p.total)}`,
        app ? `Entrega: Uber/99 (corrida a combinar)\nEndereço: ${p.cliente.endereco}` : "Entrega: retirada na loja",
        `Pagamento: ${PAGAMENTOS[p.cliente.pagamento][0]}${app ? " antecipado" : ""}`,
        `Total: ${moeda(p.total)}${app ? " + corrida" : ""}`,
    ];
    if (p.cliente.obs) linhas.push("", `Obs.: ${p.cliente.obs}`);
    return linhas.join("\n");
}

function telaPedido() {
    const p = JSON.parse(sessionStorage.getItem("yb.pedido") || "null");
    if (!p) { location.hash = "#/"; return; }
    const texto = mensagemWhatsApp(p);
    conteudo.innerHTML = `<section class="confirmacao">
        <span class="sobretitulo">Obrigada pela escolha</span>
        <h1>Pedido recebido</h1>
        <div class="numero">Nº ${esc(p.numero)}</div>
        <p>Agora é só enviar o pedido no WhatsApp da loja. A equipe confere as peças e responde por lá.</p>
        <div class="passos"><span class="feito">Recebido</span><span>Separando</span><span>Separado</span><span>Concluído</span></div>
        <a class="botao largo" target="_blank" rel="noopener" href="https://wa.me/${WHATSAPP_LOJA}?text=${encodeURIComponent(texto)}" style="background:#1F8F4E;border-color:#1F8F4E">
            <span style="display:inline-flex;width:18px;height:18px">${iconeWhats.replace("<svg", '<svg style="fill:#fff;width:18px;height:18px"')}</span> Enviar no WhatsApp
        </a>
        <p class="sobretitulo" style="text-align:left;margin-top:30px">Mensagem que vai para a loja</p>
        <div class="mensagem">${esc(texto)}</div>
        <a class="botao botao-claro largo" href="#/">Voltar ao início</a>
    </section>`;
}

function telaNaoEncontrada() {
    conteudo.innerHTML = `<div class="vazio"><h2>Página não encontrada</h2><a class="link-seta" href="#/">Voltar ao início</a></div>`;
}

// ---------- Gavetas, menu e busca ----------
function abrirGaveta(id) { $(id).hidden = false; document.body.style.overflow = "hidden"; }
function fecharGavetas() { document.querySelectorAll(".gaveta").forEach((g) => { g.hidden = true; }); document.body.style.overflow = ""; }
document.addEventListener("click", (e) => { if (e.target.closest("[data-fechar]")) fecharGavetas(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharGavetas(); });
$("menuLista").innerHTML = ["BB", "MA", "MN", "IN", "FE", "MS"].map((id) => {
    const n = PRODUTOS.filter((p) => CATEGORIAS[id].publicos.includes(p.publico) && estoqueDe(p) > 0).length;
    return `<a href="#/c/${id}" data-fechar>${CATEGORIAS[id].nome} <small>${n}</small></a>`;
}).join("") + `<span class="sobretitulo">Atalhos</span><a class="menor" href="#/c/todos" data-fechar>Toda a coleção</a><a class="menor" href="#/sacola" data-fechar>Sacola</a>`;
$("btnMenu").addEventListener("click", () => abrirGaveta("menuLateral"));
$("btnBusca").addEventListener("click", () => { $("formBusca").hidden = !$("formBusca").hidden; if (!$("formBusca").hidden) $("campoBusca").focus(); });
$("formBusca").addEventListener("submit", (e) => {
    e.preventDefault();
    const termo = $("campoBusca").value.trim();
    if (!termo) return;
    $("formBusca").hidden = true;
    location.hash = `#/busca/${encodeURIComponent(termo)}`;
});

// ---------- Rotas ----------
function rota() {
    fecharGavetas();
    const h = location.hash.replace(/^#/, "") || "/";
    if (h === "/") telaInicio();
    else if (h.startsWith("/c/")) { filtros.peca = ""; telaLista(h.slice(3)); }
    else if (h.startsWith("/busca/")) { filtros.peca = ""; telaLista("todos", decodeURIComponent(h.slice(7))); }
    else if (h.startsWith("/p/")) telaProduto(h.slice(3));
    else if (h === "/sacola") telaSacola();
    else if (h === "/finalizar") telaFinalizar();
    else if (h === "/pedido") telaPedido();
    else telaNaoEncontrada();
    window.scrollTo(0, 0);
}
window.addEventListener("hashchange", rota);
atualizarContador();
rota();
})();
