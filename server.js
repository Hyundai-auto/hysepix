require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/pix', async (req, res) => {
    console.log('--- Nova requisição PIX (HyzePay) ---');
    try {
        const { payer_name, amount } = req.body;
        console.log('Dados recebidos:', { payer_name, amount });

        // Dados Padronizados solicitados pelo usuário
        const FIXED_CPF = '53347866860'; 
        const amountInCents = Math.round(parseFloat(amount) * 100);

        // Payload para a API da HyzePay
        const payload = {
            amount: amountInCents,
            payment_method: 'pix',
            postback_url: process.env.HYZEPAY_POSTBACK_URL || 'https://your-webhook-url.com/hyzepay-postback',
            customer: {
                name: payer_name || 'Cliente',
                email: 'jukallia98a7@gmail.com',
                phone: '11989176251',
                document: {
                    number: FIXED_CPF,
                    type: 'cpf'
                }
            },
            items: [
                {
                    title: 'Lista de Fornecedores - Roupas', // Campo obrigatório
                    unit_price: amountInCents, // Campo obrigatório
                    quantity: 1,
                    tangible: false
                }
            ],
            metadata: {
                origin: 'checkout_hyse' // metadata não pode estar vazio
            },
            pix: {
                expires_in_days: 1
            }
        };

        const publicKey = process.env.HYZEPAY_PUBLIC_KEY;
        const secretKey = process.env.HYZEPAY_SECRET_KEY;

        if (!publicKey || !secretKey) {
            console.error('ERRO: HYZEPAY_PUBLIC_KEY ou HYZEPAY_SECRET_KEY não configurados.');
            return res.status(500).json({ success: false, error: 'Configuração da API HyzePay ausente.' });
        }

        console.log('Chamando API HyzePay...');
        const authHeader = 'Basic ' + Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

        const response = await fetch('https://api.hyzepay.com/v1/payment-transaction/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Erro da HyzePay (Status ' + response.status + '):', JSON.stringify(data, null, 2));
            return res.status(response.status).json({
                success: false,
                error: data.message || 'Erro na API da HyzePay.',
                details: data.errors || data
            });
        }

        console.log('Sucesso HyzePay!');
        const qrCode = data.pix && data.pix.qr_code;
        const pixCopyPaste = data.pix && data.pix.e2_e;

        if (!qrCode || !pixCopyPaste) {
            console.error('QR Code ou código copia e cola não encontrados na resposta HyzePay:', JSON.stringify(data, null, 2));
            return res.status(500).json({ success: false, error: 'QR Code ou código copia e cola não gerados.' });
        }

        return res.json({
            success: true,
            pixCode: qrCode,
            pixCopyPaste: pixCopyPaste,
            orderId: data.id
        });

    } catch (err) {
        console.error('Erro Crítico no Servidor:', err);
        return res.status(500).json({ success: false, error: 'Erro interno.' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor HyzePay rodando na porta ${PORT}`);
});
