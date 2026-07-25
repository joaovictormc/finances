# Identificação de itens que necessitam de correções durante o teste do app web

### Visão Geral
- Durante os testes no linux de homologação, a tela de visão geral não abre de forma natural, somente passando /overview na url. Mesmo assim, passando o destino na url ela não carregava os balanços de transação já cadastrado.


### Importação de extratos
- Importação está muito manual, quando uma pessoa precisar de importar o extrato de varios meses ela precisa selecionar um arquivo, importar e depois repetir o processo várias vezes. Podemos redefinir essa função deixando possível importar arquivos em massa tanto para área de cartão de crédito como extrato de conta corrente

### Desempenho do backend/frontend
- Algumas operações simples, como troca de tela, estão demorando para serem processadas, ficam em loading infinito ou levam um tempo considerável para abrir