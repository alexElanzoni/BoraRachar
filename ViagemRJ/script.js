// script.js - BoraRachar (versão final corrigida)
document.addEventListener('DOMContentLoaded', () => {
    if (!window.supabase) {
        console.error('Supabase não carregado');
        return;
    }
    const SUPABASE_URL = 'https://ultemdmenmsooigfprcm.supabase.co';
    const SUPABASE_KEY = 'sb_publishable__O-lxtTHmULM0gR5Np8PDw_ejiafGVy';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    let usuarios = [];
    let gastos = [];
    let viagemAtual = null;
    // DOM elements
    const telaInicial = document.getElementById('telaInicial');
    const telaGastos = document.getElementById('telaGastos');
    const nomeViagemAtualSpan = document.getElementById('nomeViagemAtual');
    const statusMsg = document.getElementById('statusMessage');
    const peopleListDiv = document.getElementById('peopleList');
    const expensesListDiv = document.getElementById('expensesList');
    const balanceSummaryDiv = document.getElementById('balanceSummary');
    const paidBySelect = document.getElementById('paidBy');
    const participantsContainer = document.getElementById('participantsContainer');
    // Funções auxiliares
    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('pt-BR');
    }
    function showStatus(msg, type = 'success') {
        statusMsg.textContent = msg;
        statusMsg.className = `status-message ${type}`;
        setTimeout(() => statusMsg.className = 'status-message', 4000);
    }
    async function copiarTexto(texto) {
        try {
            await navigator.clipboard.writeText(texto);
            showStatus('Código copiado! Compartilhe com seus amigos.', 'success');
        } catch (err) {
            alert('Copie manualmente: ' + texto);
        }
    }
    function gerarCodigo() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let cod = '';
        for (let i = 0; i < 6; i++) cod += chars[Math.floor(Math.random() * chars.length)];
        return cod.slice(0,3) + '-' + cod.slice(3);
    }
    /** Normaliza id (evita falha de match UUID string vs objeto / caixa diferente). */
    function normId(id) {
        if (id == null || id === '') return '';
        return String(id).trim().toLowerCase();
    }
    /**
     * Saldo líquido por pessoa em centavos: total pago (adiantamentos) − total devido (cota justa).
     * Positivo = credor (recebe no acerto); negativo = devedor (paga no acerto).
     * Compensação entre gastos é automática porque é um único saldo acumulado.
     */
    function computeNetBalancesCents(usuariosList, gastosList) {
        const saldoCents = {};
        usuariosList.forEach(u => { saldoCents[normId(u.id)] = 0; });
        const known = new Set(Object.keys(saldoCents));
        for (const g of gastosList) {
            if (!g.participantes || g.participantes.length === 0) continue;
            const n = g.participantes.length;
            const totalCents = Math.round(Number(g.valor) * 100);
            if (!Number.isFinite(totalCents) || totalCents <= 0) continue;
            const payer = normId(g.quem_pagou);
            if (!known.has(payer)) continue;
            const shareBase = Math.floor(totalCents / n);
            const remainder = totalCents - shareBase * n;
            saldoCents[payer] += totalCents;
            g.participantes.forEach((pid, idx) => {
                const id = normId(pid);
                if (!known.has(id)) return;
                const share = shareBase + (idx < remainder ? 1 : 0);
                saldoCents[id] -= share;
            });
        }
        return saldoCents;
    }
    /**
     * Liquidação global (netting): encosta devedores em credores até zerar.
     * No máximo (n−1) transferências; ordem estável por valor decrescente.
     */
    function computeSettlementTransfersCents(usuariosList, saldoCents) {
        const debtors = [];
        const creditors = [];
        usuariosList.forEach(u => {
            const id = normId(u.id);
            const s = saldoCents[id] || 0;
            if (s < 0) debtors.push({ id, nome: u.nome, remaining: -s });
            else if (s > 0) creditors.push({ id, nome: u.nome, remaining: s });
        });
        debtors.sort((a, b) => b.remaining - a.remaining);
        creditors.sort((a, b) => b.remaining - a.remaining);
        const raw = [];
        let i = 0, j = 0;
        while (i < debtors.length && j < creditors.length) {
            const d = debtors[i], c = creditors[j];
            const pay = Math.min(d.remaining, c.remaining);
            if (pay > 0) {
                raw.push({
                    devedorId: d.id,
                    credorId: c.id,
                    devedor: d.nome,
                    credor: c.nome,
                    valorCents: pay
                });
            }
            d.remaining -= pay;
            c.remaining -= pay;
            if (d.remaining === 0) i++;
            if (c.remaining === 0) j++;
        }
        return mergeTransfersSamePair(raw);
    }
    /** Uma única linha por par (devedor → credor), somando centavos. */
    function mergeTransfersSamePair(transfers) {
        const map = new Map();
        for (const t of transfers) {
            const key = `${t.devedorId}|${t.credorId}`;
            if (!map.has(key)) {
                map.set(key, { devedorId: t.devedorId, credorId: t.credorId, devedor: t.devedor, credor: t.credor, valorCents: 0 });
            }
            map.get(key).valorCents += t.valorCents;
        }
        return [...map.values()].filter(t => t.valorCents > 0);
    }
    // Viagens
    async function criarViagem(nome) {
        const codigo = gerarCodigo();
        const { data, error } = await supabase
            .from('viagens')
            .insert([{ nome, codigo }])
            .select()
            .single();
        if (error) throw error;
        return data;
    }
    async function entrarViagem(codigo) {
        const { data, error } = await supabase
            .from('viagens')
            .select('*')
            .eq('codigo', codigo)
            .single();
        if (error) throw new Error('Código inválido');
        return data;
    }
    function salvarViagemLocal(viagem) {
        localStorage.setItem('viagemAtual', JSON.stringify(viagem));
        viagemAtual = viagem;
    }
    function carregarViagemLocal() {
        const saved = localStorage.getItem('viagemAtual');
        if (saved) {
            try {
                viagemAtual = JSON.parse(saved);
                if (viagemAtual && !viagemAtual.codigo) return false;
                return true;
            } catch(e) { return false; }
        }
        return false;
    }
    function limparViagemLocal() {
        localStorage.removeItem('viagemAtual');
        viagemAtual = null;
    }
    function atualizarBadgeCodigo(codigo) {
        const span = document.getElementById('codigoViagemAtual');
        if (span) span.innerText = codigo || '---';
        const btn = document.getElementById('btnCopiarBadge');
        if (btn && codigo) btn.onclick = () => copiarTexto(codigo);
    }
    function mostrarModalCodigo(codigo) {
        const modal = document.getElementById('modalCodigo');
        if (!modal) return;
        const span = document.getElementById('codigoGerado');
        if (span) span.innerText = codigo;
        modal.style.display = 'flex';
        const btnCopiar = document.getElementById('btnCopiarModal');
        if (btnCopiar) btnCopiar.onclick = () => copiarTexto(codigo);
        const btnFechar = document.getElementById('btnFecharModal');
        if (btnFechar) btnFechar.onclick = () => { modal.style.display = 'none'; };
    }
    // Carregar dados
    async function loadUsuarios() {
        if (!viagemAtual) return [];
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('viagem_id', viagemAtual.id)
            .order('nome');
        if (error) throw error;
        usuarios = data;
        renderUsuarios();
        return data;
    }
    async function loadGastos() {
        if (!viagemAtual) return [];
        const { data, error } = await supabase
            .from('gastos')
            .select('*')
            .eq('viagem_id', viagemAtual.id)
            .order('data', { ascending: false });
        if (error) throw error;
        gastos = data;
        renderGastos();
        calcularResumoLiquido();
        return data;
    }
    // Renderização
    function renderUsuarios() {
        if (!paidBySelect || !participantsContainer || !peopleListDiv) return;
        paidBySelect.innerHTML = '<option value="">Quem pagou?</option>';
        participantsContainer.innerHTML = '';
        peopleListDiv.innerHTML = '';
        if (usuarios.length === 0) {
            participantsContainer.innerHTML = '<p class="empty-hint">Adicione pessoas ao grupo antes de lançar gastos.</p>';
            peopleListDiv.innerHTML = '<p class="empty-hint">Ninguém no grupo ainda — cadastre quem viaja.</p>';
            return;
        }
        usuarios.forEach(u => {
            paidBySelect.appendChild(new Option(u.nome, u.id));
            const cbDiv = document.createElement('div');
            cbDiv.className = 'checkbox-item';
            cbDiv.innerHTML = `<input type="checkbox" value="${u.id}" id="p_${u.id}" checked><label for="p_${u.id}">${u.nome}</label>`;
            participantsContainer.appendChild(cbDiv);
            const personDiv = document.createElement('div');
            personDiv.className = 'person-list-item';
            personDiv.innerHTML = `<span>${u.nome}</span><button type="button" class="btn btn-danger btn-small" data-id="${u.id}" data-name="${u.nome}" title="Remover pessoa" aria-label="Remover ${u.nome}"><i class="fas fa-trash-can" aria-hidden="true"></i></button>`;
            const delBtn = personDiv.querySelector('button');
            if (delBtn) {
                delBtn.addEventListener('click', async () => {
                    if (confirm(`Excluir ${u.nome}?`)) {
                        try {
                            await supabase.from('usuarios').delete().eq('id', u.id);
                            showStatus(`${u.nome} removido`);
                            await loadUsuarios();
                            await loadGastos();
                        } catch(err) {
                            showStatus('Erro: pessoa tem gastos associados', 'error');
                        }
                    }
                });
            }
            peopleListDiv.appendChild(personDiv);
        });
    }
    function renderGastos() {
        if (!expensesListDiv) return;
        expensesListDiv.innerHTML = '';
        if (gastos.length === 0) {
            expensesListDiv.innerHTML = '<p class="empty-hint">Nenhum gasto ainda — o primeiro registro aparece aqui.</p>';
            return;
        }
        gastos.forEach(gasto => {
            const pagador = usuarios.find(u => u.id === gasto.quem_pagou)?.nome || '?';
            const participantesNomes = gasto.participantes.map(id => usuarios.find(u => u.id === id)?.nome || '?').join(', ');
            const cada = gasto.valor / gasto.participantes.length;
            const div = document.createElement('div');
            div.className = 'expense-item';
            div.innerHTML = `
                <div class="expense-item__body">
                    <div class="expense-item__title">${gasto.descricao}</div>
                    <div class="expense-item__meta">${formatDate(gasto.data)} · Pago por <strong>${pagador}</strong></div>
                    <div class="expense-item__split">Dividido entre: ${participantesNomes}</div>
                    <div class="expense-item__each">Por pessoa: ${formatCurrency(cada)}</div>
                </div>
                <div class="expense-item__side">
                    <div class="expense-item__amount">${formatCurrency(gasto.valor)}</div>
                    <button type="button" class="btn btn-danger btn-small delete-expense" data-id="${gasto.id}">Apagar</button>
                </div>
            `;
            const delBtn = div.querySelector('.delete-expense');
            if (delBtn) {
                delBtn.addEventListener('click', async () => {
                    if (confirm('Apagar este gasto?')) {
                        await supabase.from('gastos').delete().eq('id', gasto.id);
                        showStatus('Gasto removido');
                        await loadGastos();
                    }
                });
            }
            expensesListDiv.appendChild(div);
        });
    }
    function calcularResumoLiquido() {
        if (!balanceSummaryDiv) return;
        balanceSummaryDiv.innerHTML = '';
        if (usuarios.length === 0 || gastos.length === 0) {
            balanceSummaryDiv.innerHTML = '<p class="empty-hint">Com pessoas e pelo menos um gasto, aparecem aqui as transferências sugeridas.</p>';
            return;
        }
        const saldoCents = computeNetBalancesCents(usuarios, gastos);
        const transfers = computeSettlementTransfersCents(usuarios, saldoCents);
        if (transfers.length === 0) {
            balanceSummaryDiv.innerHTML = '<p class="empty-hint">Saldo líquido zerado — nada a acertar entre o grupo.</p>';
            return;
        }
        const grupos = {};
        transfers.forEach(t => {
            const valor = t.valorCents / 100;
            if (!grupos[t.devedor]) grupos[t.devedor] = [];
            grupos[t.devedor].push({ credor: t.credor, valor });
        });
        for (const devedor in grupos) {
            const div = document.createElement('div');
            div.className = 'settle-card';
            div.innerHTML = `<div class="settle-card__who"><i class="fas fa-right-left" aria-hidden="true"></i> ${devedor} paga</div>`;
            grupos[devedor].forEach(item => {
                div.innerHTML += `<div class="settle-row"><span>Para ${item.credor}</span><span>${formatCurrency(item.valor)}</span></div>`;
            });
            balanceSummaryDiv.appendChild(div);
        }
    }
    async function addUsuario(nome) {
        if (!nome.trim()) throw new Error('Nome vazio');
        if (usuarios.some(u => u.nome.toLowerCase() === nome.toLowerCase())) throw new Error('Já existe');
        await supabase.from('usuarios').insert([{ nome: nome.trim(), viagem_id: viagemAtual.id }]);
        await loadUsuarios();
    }
    async function addGasto(dados) {
        const gastoCompleto = {
            descricao: dados.descricao,
            valor: dados.valor,
            data: dados.data,
            quem_pagou: dados.quem_pagou,
            participantes: dados.participantes,
            viagem_id: viagemAtual.id
        };
        await supabase.from('gastos').insert([gastoCompleto]);
        await loadGastos();
    }
    // ==================== FINALIZAR VIAGEM (CORRIGIDA) ====================
    async function gerarRelatorioTexto() {
        let now = new Date();
        let dataHora = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
        let relatorio = `RELATÓRIO FINAL - VIAGEM: ${viagemAtual.nome.toUpperCase()}\n`;
        relatorio += `Gerado em: ${dataHora}\n`;
        relatorio += `Código da viagem: ${viagemAtual.codigo}\n`;
        relatorio += `=============================================\n\n`;
        relatorio += `*** Fim da Viagem, está na hora dos pagamentos: Que os Jogos Comecem! ***\n\n`;
        relatorio += `== SALDOS FINAIS (quem deve para quem, líquido global) ==\n`;
        const saldoCentsRel = computeNetBalancesCents(usuarios, gastos);
        const transfersRel = computeSettlementTransfersCents(usuarios, saldoCentsRel);
        if (transfersRel.length === 0) {
            relatorio += `Nenhuma pendência. Todos estão quitados!\n`;
        } else {
            relatorio += transfersRel
                .map(t => `${t.devedor} deve pagar R$ ${(t.valorCents / 100).toFixed(2)} para ${t.credor}`)
                .join('\n');
        }
        relatorio += `\n\n`;
        relatorio += `== LISTA DE GASTOS ==\n`;
        gastos.forEach((g, idx) => {
            let pagador = usuarios.find(u => u.id === g.quem_pagou)?.nome || '?';
            let participantes = g.participantes.map(pid => usuarios.find(u => u.id === pid)?.nome || '?').join(', ');
            let cada = g.valor / g.participantes.length;
            relatorio += `${idx+1}. ${formatDate(g.data)} - ${g.descricao}\n`;
            relatorio += `   Valor total: R$ ${g.valor.toFixed(2)}\n`;
            relatorio += `   Pago por: ${pagador}\n`;
            relatorio += `   Participantes: ${participantes}\n`;
            relatorio += `   Cada um deve: R$ ${cada.toFixed(2)}\n\n`;
        });
        return relatorio;
    }
    async function excluirDadosViagem() {
        if (!viagemAtual) return;
        await supabase.from('gastos').delete().eq('viagem_id', viagemAtual.id);
        await supabase.from('usuarios').delete().eq('viagem_id', viagemAtual.id);
        await supabase.from('viagens').delete().eq('id', viagemAtual.id);
    }
    function salvarRelatorioNoCelular(conteudo, nomeArquivo) {
        const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    async function compartilharWhatsApp(blob, texto) {
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'relatorio.txt', {type: 'text/plain'})] })) {
            try {
                const file = new File([blob], 'relatorio.txt', { type: 'text/plain' });
                await navigator.share({
                    title: 'Relatório da viagem',
                    text: texto,
                    files: [file]
                });
                return true;
            } catch(e) { return false; }
        } else {
            alert('Relatório salvo na pasta Downloads. Compartilhe manualmente se desejar.');
            return false;
        }
    }
    function iniciarTelaGastos() {
        if (telaInicial) telaInicial.style.display = 'none';
        if (telaGastos) telaGastos.style.display = 'block';
        if (nomeViagemAtualSpan) nomeViagemAtualSpan.innerText = viagemAtual.nome;
        atualizarBadgeCodigo(viagemAtual.codigo);
        loadUsuarios();
        loadGastos();
    }
    function fecharFormulariosViagem() {
        const areaCriar = document.getElementById('areaCriar');
        const areaEntrar = document.getElementById('areaEntrar');
        if (areaCriar) areaCriar.hidden = true;
        if (areaEntrar) areaEntrar.hidden = true;
        document.getElementById('cardCriar')?.classList.remove('choice-card--active');
        document.getElementById('cardEntrar')?.classList.remove('choice-card--active');
        document.getElementById('btnMostrarCriar')?.setAttribute('aria-expanded', 'false');
        document.getElementById('btnMostrarEntrar')?.setAttribute('aria-expanded', 'false');
    }
    function abrirFormularioViagem(tipo) {
        const areaCriar = document.getElementById('areaCriar');
        const areaEntrar = document.getElementById('areaEntrar');
        const cardCriar = document.getElementById('cardCriar');
        const cardEntrar = document.getElementById('cardEntrar');
        const btnCriar = document.getElementById('btnMostrarCriar');
        const btnEntrar = document.getElementById('btnMostrarEntrar');
        if (tipo === 'criar') {
            if (areaEntrar) areaEntrar.hidden = true;
            if (areaCriar) areaCriar.hidden = false;
            cardCriar?.classList.add('choice-card--active');
            cardEntrar?.classList.remove('choice-card--active');
            btnCriar?.setAttribute('aria-expanded', 'true');
            btnEntrar?.setAttribute('aria-expanded', 'false');
            requestAnimationFrame(() => {
                areaCriar?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => document.getElementById('nomeViagem')?.focus({ preventScroll: true }), 400);
            });
        } else {
            if (areaCriar) areaCriar.hidden = true;
            if (areaEntrar) areaEntrar.hidden = false;
            cardEntrar?.classList.add('choice-card--active');
            cardCriar?.classList.remove('choice-card--active');
            btnEntrar?.setAttribute('aria-expanded', 'true');
            btnCriar?.setAttribute('aria-expanded', 'false');
            requestAnimationFrame(() => {
                areaEntrar?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => document.getElementById('codigoAcesso')?.focus({ preventScroll: true }), 400);
            });
        }
    }

    // ---------- EVENTOS ----------
    const btnMostrarCriar = document.getElementById('btnMostrarCriar');
    if (btnMostrarCriar) {
        btnMostrarCriar.onclick = () => abrirFormularioViagem('criar');
    }
    const btnMostrarEntrar = document.getElementById('btnMostrarEntrar');
    if (btnMostrarEntrar) {
        btnMostrarEntrar.onclick = () => abrirFormularioViagem('entrar');
    }
    const confirmarCriar = document.getElementById('confirmarCriar');
    if (confirmarCriar) {
        confirmarCriar.onclick = async () => {
            const nomeInput = document.getElementById('nomeViagem');
            if (!nomeInput) return;
            const nome = nomeInput.value.trim();
            if (!nome) return showStatus('Digite um nome', 'error');
            try {
                const viagem = await criarViagem(nome);
                salvarViagemLocal(viagem);
                mostrarModalCodigo(viagem.codigo);
                iniciarTelaGastos();
            } catch(err) {
                showStatus('Erro ao criar: '+err.message, 'error');
                console.error(err);
            }
        };
    }
    const confirmarEntrar = document.getElementById('confirmarEntrar');
    if (confirmarEntrar) {
        confirmarEntrar.onclick = async () => {
            const codigoInput = document.getElementById('codigoAcesso');
            if (!codigoInput) return;
            let codigo = codigoInput.value.trim().toUpperCase();
            if (!codigo) return showStatus('Digite o código', 'error');
            try {
                const viagem = await entrarViagem(codigo);
                salvarViagemLocal(viagem);
                iniciarTelaGastos();
            } catch(err) {
                showStatus('Código inválido', 'error');
            }
        };
    }
    const btnSairViagem = document.getElementById('btnSairViagem');
    if (btnSairViagem) {
        btnSairViagem.onclick = () => {
            limparViagemLocal();
            if (telaGastos) telaGastos.style.display = 'none';
            if (telaInicial) telaInicial.style.display = 'block';
            fecharFormulariosViagem();
            const nomeViagemInput = document.getElementById('nomeViagem');
            const codigoAcessoInput = document.getElementById('codigoAcesso');
            if (nomeViagemInput) nomeViagemInput.value = '';
            if (codigoAcessoInput) codigoAcessoInput.value = '';
        };
    }
    const btnFinalizar = document.getElementById('btnFinalizarViagem');
    if (btnFinalizar) {
        btnFinalizar.onclick = async () => {
            if (!viagemAtual) {
                showStatus('Nenhuma viagem ativa', 'error');
                return;
            }
            if (!confirm('⚠️ Atenção: essa ação irá ENCERRAR A VIAGEM e EXCLUIR TODOS OS DADOS. Um relatório será salvo. Continuar?')) return;
            const confirmacao = prompt('Digite a palavra FINALIZAR (em maiúsculas) para confirmar:');
            if (!confirmacao) return;
            if (confirmacao.trim().toUpperCase() !== 'FINALIZAR') {
                showStatus('Palavra incorreta. Operação cancelada.', 'error');
                return;
            }
            const nomeViagem = viagemAtual.nome;
            showStatus('Gerando relatório e finalizando...', 'success');
            try {
                const relatorio = await gerarRelatorioTexto();
                const nomeArquivo = `relatorio_${nomeViagem.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.txt`;
                salvarRelatorioNoCelular(relatorio, nomeArquivo);
                await excluirDadosViagem();
                limparViagemLocal();
                if (telaGastos) telaGastos.style.display = 'none';
                if (telaInicial) telaInicial.style.display = 'block';
                const blob = new Blob([relatorio], { type: 'text/plain' });
                await compartilharWhatsApp(blob, `Relatório da viagem "${nomeViagem}"`);
                showStatus('Viagem finalizada com sucesso!', 'success');
                usuarios = [];
                gastos = [];
                viagemAtual = null;
            } catch (error) {
                console.error('Erro:', error);
                showStatus('Erro ao finalizar: ' + error.message, 'error');
            }
        };
    } else {
        console.error('Botão "btnFinalizarViagem" não encontrado');
    }
    const expenseForm = document.getElementById('expenseForm');
    if (expenseForm) {
        expenseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!viagemAtual) return;
            const description = document.getElementById('description')?.value.trim();
            const amount = parseFloat(document.getElementById('amount')?.value);
            const date = document.getElementById('date')?.value;
            const paidBy = document.getElementById('paidBy')?.value;
            const participantes = Array.from(document.querySelectorAll('#participantsContainer input:checked')).map(cb => cb.value);
            if (!description || !amount || !date || !paidBy || participantes.length === 0) {
                return showStatus('Preencha todos os campos', 'error');
            }
            await addGasto({ descricao: description, valor: amount, data: date, quem_pagou: paidBy, participantes });
            const descInput = document.getElementById('description');
            const amountInput = document.getElementById('amount');
            const dateInput = document.getElementById('date');
            if (descInput) descInput.value = '';
            if (amountInput) amountInput.value = '';
            if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
            if (paidBySelect) paidBySelect.selectedIndex = 0;
            showStatus('Gasto adicionado!');
        });
    }
    const addPersonBtn = document.getElementById('addPersonBtn');
    if (addPersonBtn) {
        addPersonBtn.onclick = async () => {
            const nomeInput = document.getElementById('newPersonName');
            if (!nomeInput) return;
            const nome = nomeInput.value.trim();
            if (!nome) return showStatus('Digite um nome', 'error');
            await addUsuario(nome);
            nomeInput.value = '';
            showStatus(`Pessoa ${nome} adicionada`);
        };
    }
    // Inicialização
    if (carregarViagemLocal()) {
        if (!viagemAtual.codigo) {
            limparViagemLocal();
            if (telaInicial) telaInicial.style.display = 'block';
            if (telaGastos) telaGastos.style.display = 'none';
            showStatus('Sessão antiga limpa. Crie uma nova viagem.', 'error');
        } else {
            iniciarTelaGastos();
        }
    } else {
        if (telaInicial) telaInicial.style.display = 'block';
        if (telaGastos) telaGastos.style.display = 'none';
    }
});