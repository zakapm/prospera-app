// URL base ajustada para relativo (funciona automaticamente em dev e producao)
const API_URL = '';

let transacoes = [];
let financiamentos = [];
let metas = [];
let meuGrafico = null;

// Elementos de Autenticação
const secaoAuth = document.getElementById('secao-auth');
const secaoApp = document.getElementById('secao-app');
const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro');
const nomeUsuarioLogadoEl = document.getElementById('nome-usuario-logado');

function alternarAuth(tela) {
    if (tela === 'cadastro') {
        formLogin.style.display = 'none';
        formCadastro.style.display = 'block';
    } else {
        formCadastro.style.display = 'none';
        formLogin.style.display = 'block';
    }
}

// Função auxiliar para requisições na API aceitando com ou sem o prefixo /api
async function fetchAPI(endpoint, options = {}) {
    let response = await fetch(`${API_URL}${endpoint}`, options);
    if (response.status === 404 && !endpoint.startsWith('/api')) {
        response = await fetch(`${API_URL}/api${endpoint}`, options);
    }
    return response;
}

if (formCadastro) {
    formCadastro.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('cad-nome').value;
        const email = document.getElementById('cad-email').value;
        const senha = document.getElementById('cad-senha').value;

        try {
            const res = await fetchAPI('/registrar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, email, senha })
            });
            const data = await res.json();
            if (res.ok) {
                alert("Conta criada com sucesso!");
                formCadastro.reset();
                alternarAuth('login');
            } else alert(data.erro || "Erro ao cadastrar.");
        } catch (err) { alert("Erro ao conectar ao servidor."); }
    });
}

if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const senha = document.getElementById('login-senha').value;

        try {
            const res = await fetchAPI('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('prospera_token', data.token);
                localStorage.setItem('prospera_usuario', JSON.stringify(data.usuario));
                iniciarApp();
            } else alert(data.erro || "Erro no login.");
        } catch (err) { alert("Erro ao conectar ao servidor."); }
    });
}

function fazerLogout() {
    localStorage.removeItem('prospera_token');
    localStorage.removeItem('prospera_usuario');
    if (secaoApp) secaoApp.style.display = 'none';
    if (secaoAuth) secaoAuth.style.display = 'flex';
}

function obterHeadersAuth() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('prospera_token')}`
    };
}

function formatarMoeda(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarData(d) { if (!d) return ''; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; }

// INICIALIZAR APLICAÇÃO
function iniciarApp() {
    const usuario = JSON.parse(localStorage.getItem('prospera_usuario'));
    if (!usuario) return fazerLogout();

    if (nomeUsuarioLogadoEl) nomeUsuarioLogadoEl.innerText = usuario.nome;
    if (secaoAuth) secaoAuth.style.display = 'none';
    if (secaoApp) secaoApp.style.display = 'block';

    const hoje = new Date();
    const inputData = document.getElementById('data');
    const inputFiltroMes = document.getElementById('filtro-mes');
    
    if (inputData) inputData.valueAsDate = hoje;
    if (inputFiltroMes) inputFiltroMes.value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    carregarTodosOsDados();
}

async function carregarTodosOsDados() {
    await Promise.all([carregarTransacoes(), carregarFinanciamentos(), carregarMetas()]);
}

// TRANSAÇÕES
async function carregarTransacoes() {
    try {
        const res = await fetchAPI('/transacoes', { headers: obterHeadersAuth() });
        if (res.status === 401 || res.status === 403) return fazerLogout();
        transacoes = await res.json();
        filtrarTransacoes();
    } catch (err) {
        console.error("Erro ao carregar transações:", err);
    }
}

const formTransacao = document.getElementById('form-transacao');
if (formTransacao) {
    formTransacao.addEventListener('submit', async (e) => {
        e.preventDefault();
        const t = {
            descricao: document.getElementById('descricao').value,
            valor: parseFloat(document.getElementById('valor').value),
            tipo: document.getElementById('tipo').value,
            categoria: document.getElementById('categoria').value,
            data: document.getElementById('data').value
        };
        await fetchAPI('/transacoes', { method: 'POST', headers: obterHeadersAuth(), body: JSON.stringify(t) });
        document.getElementById('descricao').value = '';
        document.getElementById('valor').value = '';
        document.getElementById('categoria').value = '';
        carregarTransacoes();
    });
}

async function removerTransacao(id) {
    await fetchAPI(`/transacoes/${id}`, { method: 'DELETE', headers: obterHeadersAuth() });
    carregarTransacoes();
}

function filtrarTransacoes() {
    const buscaEl = document.getElementById('busca');
    const mesEl = document.getElementById('filtro-mes');
    const termo = buscaEl ? buscaEl.value.toLowerCase() : '';
    const mes = mesEl ? mesEl.value : '';

    const filtradas = Array.isArray(transacoes) ? transacoes.filter(t => {
        const okBusca = (t.descricao && t.descricao.toLowerCase().includes(termo)) || 
                        (t.categoria && t.categoria.toLowerCase().includes(termo));
        const okMes = mes ? (t.data && t.data.startsWith(mes)) : true;
        return okBusca && okMes;
    }) : [];

    renderizarTransacoes(filtradas);
    atualizarResumo(filtradas);
    atualizarGrafico(filtradas);
}

function renderizarTransacoes(lista) {
    const el = document.getElementById('lista-transacoes');
    if (!el) return;
    el.innerHTML = '';
    if (lista.length === 0) {
        el.innerHTML = '<li style="justify-content: center; color: #64748b;">Nenhuma transação cadastrada.</li>';
        return;
    }
    lista.forEach(t => {
        const li = document.createElement('li');
        const eEntrada = t.tipo && t.tipo.toString().toLowerCase().trim() === 'entrada';
        li.className = eEntrada ? 'entrada-item' : 'saida-item';
        const sinal = eEntrada ? '+' : '-';
        li.innerHTML = `
            <div>
                <strong>${t.descricao}</strong><br>
                <small>🏷 ${t.categoria} | 📅 ${formatarData(t.data)}</small>
            </div>
            <div>
                <span>${sinal} ${formatarMoeda(t.valor)}</span>
                <button class="btn-deletar" onclick="removerTransacao(${t.id})">❌</button>
            </div>
        `;
        el.appendChild(li);
    });
}

function atualizarResumo(lista) {
    const ent = lista
        .filter(t => t.tipo && t.tipo.toString().toLowerCase().trim() === 'entrada')
        .reduce((a, b) => a + Number(b.valor), 0);

    const sai = lista
        .filter(t => t.tipo && t.tipo.toString().toLowerCase().trim() === 'saida')
        .reduce((a, b) => a + Number(b.valor), 0);

    const totalEntradasEl = document.getElementById('total-entradas');
    const totalSaidasEl = document.getElementById('total-saidas');
    const totalSaldoEl = document.getElementById('total-saldo');

    if (totalEntradasEl) totalEntradasEl.innerText = formatarMoeda(ent);
    if (totalSaidasEl) totalSaidasEl.innerText = formatarMoeda(sai);
    if (totalSaldoEl) totalSaldoEl.innerText = formatarMoeda(ent - sai);
}

// GRÁFICO COMPARATIVO COM SALDO NO CENTRO
function atualizarGrafico(lista) {
    const canvas = document.getElementById('graficoCategoria');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const totalEntradas = lista
        .filter(t => t.tipo && t.tipo.toString().toLowerCase().trim() === 'entrada')
        .reduce((acc, t) => acc + Number(t.valor), 0);

    const totalSaidas = lista
        .filter(t => t.tipo && t.tipo.toString().toLowerCase().trim() === 'saida')
        .reduce((acc, t) => acc + Number(t.valor), 0);

    const saldo = totalEntradas - totalSaidas;

    if (meuGrafico) {
        meuGrafico.destroy();
    }

    if (totalEntradas === 0 && totalSaidas === 0) return;

    const pluginTextoCentro = {
        id: 'textoCentro',
        beforeDraw(chart) {
            const { width, height, ctx } = chart;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.font = '500 12px sans-serif';
            ctx.fillStyle = '#64748b';
            ctx.fillText('Saldo Livre', width / 2, height / 2 - 10);

            ctx.font = 'bold 16px sans-serif';
            ctx.fillStyle = saldo >= 0 ? '#059669' : '#ef4444';
            ctx.fillText(formatarMoeda(saldo), width / 2, height / 2 + 10);

            ctx.restore();
        }
    };

    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Entradas', 'Saídas'],
            datasets: [{
                data: [totalEntradas, totalSaidas],
                backgroundColor: ['#059669', '#ef4444'],
                borderWidth: 2,
                borderColor: '#ffffff',
                cutout: '70%'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 15 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const valor = context.raw || 0;
                            return ` ${context.label}: R$ ${valor.toFixed(2).replace('.', ',')}`;
                        }
                    }
                }
            }
        },
        plugins: [pluginTextoCentro]
    });
}

// FINANCIAMENTOS
async function carregarFinanciamentos() {
    try {
        const res = await fetchAPI('/financiamentos', { headers: obterHeadersAuth() });
        financiamentos = await res.json();
        renderizarFinanciamentos();
    } catch (err) {
        console.error("Erro ao carregar financiamentos:", err);
    }
}

const formFinanciamento = document.getElementById('form-financiamento');
if (formFinanciamento) {
    formFinanciamento.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = {
            nome: document.getElementById('fin-nome').value,
            valorTotal: parseFloat(document.getElementById('fin-valor-total').value),
            valorParcela: parseFloat(document.getElementById('fin-parcela').value),
            totalParcelas: parseInt(document.getElementById('fin-total-parcelas').value),
            parcelasPagas: parseInt(document.getElementById('fin-pagas').value)
        };
        await fetchAPI('/financiamentos', { method: 'POST', headers: obterHeadersAuth(), body: JSON.stringify(f) });
        document.getElementById('fin-nome').value = '';
        document.getElementById('fin-valor-total').value = '';
        document.getElementById('fin-parcela').value = '';
        document.getElementById('fin-total-parcelas').value = '';
        document.getElementById('fin-pagas').value = '0';
        carregarFinanciamentos();
    });
}

async function pagarParcela(id, pagasAtuais) {
    await fetchAPI(`/financiamentos/${id}`, {
        method: 'PUT',
        headers: obterHeadersAuth(),
        body: JSON.stringify({ parcelasPagas: pagasAtuais + 1 })
    });
    carregarFinanciamentos();
}

async function removerFinanciamento(id) {
    await fetchAPI(`/financiamentos/${id}`, { method: 'DELETE', headers: obterHeadersAuth() });
    carregarFinanciamentos();
}

function renderizarFinanciamentos() {
    const el = document.getElementById('lista-financiamentos');
    if (!el) return;
    el.innerHTML = '';
    if (!Array.isArray(financiamentos) || financiamentos.length === 0) {
        el.innerHTML = '<p style="color: #64748b; font-size: 14px;">Nenhum financiamento cadastrado.</p>';
        return;
    }
    financiamentos.forEach(f => {
        const pct = Math.round((f.parcelasPagas / f.totalParcelas) * 100);
        const div = document.createElement('div');
        div.style = "background: #f8fafc; padding: 12px; margin-bottom: 10px; border-radius: 8px; border: 1px solid #e2e8f0;";
        div.innerHTML = `
            <strong>${f.nome}</strong> - ${f.parcelasPagas}/${f.totalParcelas} parcelas pagas (${pct}%)<br>
            <small>Parcela: ${formatarMoeda(f.valorParcela)} | Total: ${formatarMoeda(f.valorTotal)}</small><br>
            <button onclick="pagarParcela(${f.id}, ${f.parcelasPagas})" class="btn-principal" style="padding: 4px 8px; font-size: 12px; margin-top: 8px; width: auto; display: inline-block;">Pagar Parcela (+1)</button>
            <button onclick="removerFinanciamento(${f.id})" class="btn-deletar" style="font-size: 12px;">Excluir</button>
        `;
        el.appendChild(div);
    });
}

// METAS / CAIXINHAS
async function carregarMetas() {
    try {
        const res = await fetchAPI('/metas', { headers: obterHeadersAuth() });
        metas = await res.json();
        renderizarMetas();
    } catch (err) {
        console.error("Erro ao carregar metas:", err);
    }
}

const formMeta = document.getElementById('form-meta');
if (formMeta) {
    formMeta.addEventListener('submit', async (e) => {
        e.preventDefault();
        const m = {
            nome: document.getElementById('meta-nome').value,
            valorAlvo: parseFloat(document.getElementById('meta-alvo').value),
            valorAtual: parseFloat(document.getElementById('meta-atual').value)
        };
        await fetchAPI('/metas', { method: 'POST', headers: obterHeadersAuth(), body: JSON.stringify(m) });
        document.getElementById('meta-nome').value = '';
        document.getElementById('meta-alvo').value = '';
        document.getElementById('meta-atual').value = '0';
        carregarMetas();
    });
}

async function movimentarMeta(id, atual, valorAdd) {
    await fetchAPI(`/metas/${id}`, {
        method: 'PUT',
        headers: obterHeadersAuth(),
        body: JSON.stringify({ valorAtual: Math.max(0, atual + valorAdd) })
    });
    carregarMetas();
}

async function removerMeta(id) {
    await fetchAPI(`/metas/${id}`, { method: 'DELETE', headers: obterHeadersAuth() });
    carregarMetas();
}

function renderizarMetas() {
    const el = document.getElementById('lista-metas');
    if (!el) return;
    el.innerHTML = '';
    if (!Array.isArray(metas) || metas.length === 0) {
        el.innerHTML = '<p style="color: #64748b; font-size: 14px;">Nenhuma caixinha cadastrada.</p>';
        return;
    }
    metas.forEach(m => {
        const pct = Math.min(100, Math.round((m.valorAtual / m.valorAlvo) * 100));
        const div = document.createElement('div');
        div.style = "background: #f8fafc; padding: 12px; margin-bottom: 10px; border-radius: 8px; border: 1px solid #e2e8f0;";
        div.innerHTML = `
            <strong>${m.nome}</strong> - Guardado: ${formatarMoeda(m.valorAtual)} / Meta: ${formatarMoeda(m.valorAlvo)} (${pct}%)<br>
            <button onclick="movimentarMeta(${m.id}, ${m.valorAtual}, 50)" class="btn-principal" style="padding: 4px 8px; font-size: 12px; background: #0d9488; margin-top: 8px; width: auto; display: inline-block;">+ R$ 50</button>
            <button onclick="movimentarMeta(${m.id}, ${m.valorAtual}, -50)" class="btn-principal" style="padding: 4px 8px; font-size: 12px; background: #f59e0b; margin-top: 8px; width: auto; display: inline-block;">- R$ 50</button>
            <button onclick="removerMeta(${m.id})" class="btn-deletar" style="font-size: 12px;">Excluir</button>
        `;
        el.appendChild(div);
    });
}

// VERIFICAÇÃO INICIAL
if (localStorage.getItem('prospera_token')) {
    iniciarApp();
}