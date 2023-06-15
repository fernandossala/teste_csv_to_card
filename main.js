import $ from 'jquery';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import { XMLValidator } from 'fast-xml-parser';


let employeeData = [];
let svgData = "";
let employeeIndex = 0;
let originalRectX = null;
let originalRectY = null;
let originalRectWidth = null;
let originalRectHeight = null;
let headerMappings = {};


// Quando um arquivo CSV é carregado
$("#csv-upload").on('change', (e) => {
    // Abre o arquivo CSV
    Papa.parse(e.target.files[0], {
        header: true,
        dynamicTyping: true,
        complete: function(results) {
            // Salva os dados do CSV
            employeeData = results.data;
            // Gera a lista de cabeçalhos
            generateHeaderList();
            // Exibe o checkmark
            $("#checkmark-csv").css("display", "inline");
        }
    });
});

// Quando um arquivo SVG é carregado
$("#svg-upload").on('change', (e) => {
    // Abre o arquivo SVG
    let file = e.target.files[0];
    let reader = new FileReader();
    reader.onload = function(e) {
        svgData = e.target.result;
        // Exibe o checkmark
        $("#checkmark-svg").css("display", "inline");
    }
    reader.readAsText(file);
});

function generateHeaderList() {
    // Limpa a lista de cabeçalhos existente
    $("#header-list").empty();

    // Pega a lista de cabeçalhos do primeiro funcionário (todos terão os mesmos cabeçalhos)
    let headers = Object.keys(employeeData[0]);

    // Cria um parser DOM para pegar as IDs do SVG
    let parser = new DOMParser();

    // Substitui a sequência de caracteres "&nbsp;" pela representação do caractere invisível.
    let processedSvgData = svgData.replace(/&nbsp;/g, "\u00A0");

    let svgDoc = parser.parseFromString(processedSvgData, "image/svg+xml");

    // Lista todas as IDs presentes no SVG
    let svgIds = Array.from(svgDoc.querySelectorAll('[id]')).map(node => node.id);

    // Para cada cabeçalho
    headers.forEach(header => {
        // Adiciona uma nova linha na lista de cabeçalhos
        let listItem = $('<li></li>').text(header);
        $("#header-list").append(listItem);

        // Adiciona uma lista suspensa com os IDs SVG
        let dropdown = $('<select></select>');
       
        // Adiciona um atributo data-header ao elemento dropdown
        dropdown.attr('data-header', header);

        // Adiciona um manipulador de eventos change para salvar o mapeamento selecionado
        dropdown.on('change', function()  {
            headerMappings[header] = this.value;
        });

        // Adiciona uma opção "nenhum" para permitir ignorar o cabeçalho
        let noneOption = $('<option></option>').val('none').text('nenhum');
        dropdown.append(noneOption);

        // Adiciona opções para cada ID SVG
        svgIds.forEach(id => {
            let option = $('<option></option>').val(id).text(id);
            dropdown.append(option);
        });

        listItem.append(dropdown);
    });
    // Criar o elemento de seleção para nomear os arquivos
    let filenameDropdown = $('<select></select>').attr('id', 'filename-selector');
    let defaultOption = $('<option></option>').val('none').text('Selecione para nomear arquivos');
    filenameDropdown.append(defaultOption);

    // Adicionar opções baseadas nos cabeçalhos
    headers.forEach(header => {
        let option = $('<option></option>').val(header).text(header);
        filenameDropdown.append(option);
    });

    // Adicionar o elemento de seleção ao lado do botão "Salvar SVG Bulk"
    $("#save-svg-bulk-button").after(filenameDropdown);
}

function generateUpdatedSvg(employee) {
    let parser = new DOMParser();
    let svgDoc = parser.parseFromString(svgData, "image/svg+xml");

    // Identifique o tamanho e a posição do espaço reservado para o QR Code no SVG original
    let qrPlaceholder = svgDoc.querySelector('#qr-placeholder');
    let qrPlaceholderRect = qrPlaceholder ? qrPlaceholder.querySelector('rect') : null;

    for (let header in headerMappings) {
        let svgId = headerMappings[header];
        let textNode = svgDoc.getElementById(svgId);
        if (textNode && textNode.tagName === 'text') {
            textNode.textContent = employee[header];
        } else if (qrPlaceholder && qrPlaceholderRect && header === 'vCard') {
            let vCardString = typeof employee[header] === 'string' ? employee[header].normalize() : String(employee[header]).normalize();

            let qrWidth = parseFloat(qrPlaceholderRect.getAttribute('width') || 150);
            let qrHeight = parseFloat(qrPlaceholderRect.getAttribute('height') || 150);

            // Gere o QR Code como um elemento SVG
            let qr = new QRCode({
                msg: vCardString,
                dim: Math.min(qrWidth, qrHeight),
                pad: 0,
                mtx: 7,
                ecl: "L",
                ecb: 0,
                pal: ["#000000", "#ffffff00"],
                vrb: 1
            });
            let group = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('transform', `translate(${qrPlaceholderRect.getAttribute('x')}, ${qrPlaceholderRect.getAttribute('y')})`);
            qr.setAttribute('width', qrWidth);
            qr.setAttribute('height', qrHeight);
            group.appendChild(qr);

            // Substitua o espaço reservado pelo QR Code gerado
            qrPlaceholder.parentNode.replaceChild(group, qrPlaceholder);
        }
    }

    let serializer = new XMLSerializer();
    let updatedSvgString = serializer.serializeToString(svgDoc.documentElement);
    return updatedSvgString;
}

function updateSvgPreview() {
    let originalSvgData = svgData;  // Salva uma cópia do SVG original

    // Pega os dados do funcionário atual
    let employee = employeeData[employeeIndex];
    if (!employee) {
        console.error("Funcionário não encontrado para employeeIndex", employeeIndex);
        return;
    }

    // Cria um parser DOM para manipular o SVG
    let parser = new DOMParser();
    let serializer = new XMLSerializer();
    let processedSvgData = originalSvgData.replace(/&nbsp;/g, "\u00A0");  // Use a cópia do SVG original

    // Verifica se processedSvgData é um XML bem formado
    let result = XMLValidator.validate(processedSvgData);
    if (result !== true) {
        console.error("SVG não é bem formado");
        console.error("Erro:", result.err);
        return;  // Se o SVG não for válido, retorne aqui
    }

    let svgDoc = parser.parseFromString(processedSvgData, "image/svg+xml");

    Array.from(svgDoc.querySelectorAll('text')).forEach(textNode => {
        let employeeField = Object.keys(employee).find(key => headerMappings[key] === textNode.id);
        if (employeeField) {
            let tspanNode = textNode.querySelector('tspan');
            if (tspanNode) {
                tspanNode.textContent = employee[employeeField];
            } else {
                textNode.textContent = employee[employeeField];
            }
        }
    });

    // Gera o QR Code, se houver um vCard
    if (employee.vCard) {
        let vCardString = typeof employee.vCard === 'string' ? employee.vCard.normalize() : String(employee.vCard).normalize();

        let qrPlaceholder = svgDoc.querySelector('#qr-placeholder');
        
        if (qrPlaceholder) {
            // Recupera o retângulo original dentro do qrPlaceholder antes de removê-lo
            if (originalRectX === null || originalRectY === null || originalRectWidth === null || originalRectHeight === null) {
                let originalRect = qrPlaceholder.querySelector('rect');
                if (originalRect) {
                    originalRectX = parseFloat(originalRect.getAttribute('x'));
                    originalRectY = parseFloat(originalRect.getAttribute('y'));
                    originalRectWidth = parseFloat(originalRect.getAttribute('width'));
                    originalRectHeight = parseFloat(originalRect.getAttribute('height'));
                } else {
                    console.error("Não foi possível encontrar o retângulo original no qrPlaceholder");
                    return;
                }
            }
            
            // Limpe o qrPlaceholder antes de adicionar o novo QRCode
            while (qrPlaceholder.firstChild) {
                qrPlaceholder.removeChild(qrPlaceholder.firstChild);
            }
        
            let qr = new QRCode({
                msg: vCardString,
                dim: Math.min(originalRectWidth, originalRectHeight),
                pad: 0,
                mtx: 7,
                ecl: "L",
                ecb: 0,
                pal: ["#000000", "#ffffff00"],
                vrb: 1
            });
            
            let group = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('transform', `translate(${originalRectX}, ${originalRectY})`);
            qr.setAttribute('width', originalRectWidth);
            qr.setAttribute('height', originalRectHeight);
            group.appendChild(qr);
            qrPlaceholder.appendChild(group);
        
        } else {
            console.error("Não foi possível encontrar o elemento '#qr-placeholder'");
        }
    }

    svgData = serializer.serializeToString(svgDoc);  // Salve a versão modificada para a próxima iteração
    $("#svg-preview").html(svgData);
}

function loadTemplate(event) {
    // Pega o arquivo do input
    let file = event.target.files[0];
    
    if (!file) {
        alert('Nenhum arquivo foi selecionado');
        return;
    }
    
    // Cria um FileReader para ler o conteúdo do arquivo
    let reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            // Parseia o conteúdo do arquivo como JSON
            let mapping = JSON.parse(e.target.result);
            
            // Log do objeto mapping carregado
            console.log('Objeto mapping carregado:', mapping);
            
            // Atualiza o objeto headerMappings com os valores carregados
            headerMappings = mapping;
            
            // Atualiza os campos de input com os valores carregados
            Object.keys(mapping).forEach(header => {
                let value = mapping[header];

                // Log do cabeçalho e valor sendo processados
                console.log(`Processando cabeçalho: ${header} com valor: ${value}`);

                // Procura o select associado ao cabeçalho atual usando o atributo data-header
                let dropdown = $(`select[data-header="${header}"]`);
                
                // Log do elemento dropdown encontrado
                console.log('Elemento dropdown encontrado:', dropdown);

                // Desmarca todas as opções
                dropdown.find('option').prop('selected', false);
                
                // Se o valor é válido, seleciona a opção correspondente
                if (value && value !== 'none') {
                    let option = dropdown.find(`option[value="${value}"]`);
                    
                    // Log da opção encontrada
                    console.log('Opção encontrada:', option);

                    if (option.length > 0) {
                        option.prop('selected', true);
                    } else {
                        // Seleciona a opção "nenhum" se não encontrar uma correspondência
                        dropdown.find('option[value="none"]').prop('selected', true);
                    }
                } else {
                    // Seleciona a opção "nenhum" se o valor é 'none' ou inválido
                    dropdown.find('option[value="none"]').prop('selected', true);
                }
            });

            // Exibe o checkmark
            $("#checkmark-template").css("display", "inline");
            
        } catch (error) {
            alert('Ocorreu um erro ao carregar o arquivo: ' + error);
        }
    };
    
    // Lê o arquivo como texto
    reader.readAsText(file);
}

// Quando um arquivo é selecionado, chama a função loadTemplate
$("#template-loader").on('change', loadTemplate);
  
// Quando o botão "<<" é clicado
$("#prev-button").on('click', () => {
    // Retrocede no display ao vivo do arquivo SVG
    if (employeeIndex > 0) {
        employeeIndex--;
        updateSvgPreview();
    }
});

// Quando o botão ">>" é clicado
$("#next-button").on('click', () => {
    // Avança no display ao vivo do arquivo SVG
    if (employeeIndex < employeeData.length - 1) {
        employeeIndex++;
        updateSvgPreview();
    }
});

// Quando o botão de salvar SVG é clicado
$("#save-svg-button").on('click', () => {
    // Salva o arquivo SVG modificado
    var blob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
    saveAs(blob, "modified.svg");
});

// Quando o botão de salvar template é clicado
$("#save-template-button").on('click', () => {
    // Use headerMappings como o objeto a ser salvo em JSON.
    let mapping = headerMappings;

    // Converte o objeto de mapeamento para uma string JSON.
    var jsonMappingString = JSON.stringify(mapping);

    // Cria um blob com o conteúdo da string JSON.
    var blob = new Blob([jsonMappingString], {type: "application/json;charset=utf-8"});
    
    // Usa a biblioteca FileSaver.js para salvar o blob como um arquivo JSON.
    saveAs(blob, "mapping.json");
});

$("#save-svg-bulk-button").on('click', () => {
    let filenameField = $('#filename-selector').val();
    if (filenameField === 'none') {
        alert('Por favor, selecione um campo para nomear os arquivos.');
        return;
    }
    employeeData.forEach((employee, index) => {
        // Verificar se o objeto employee não está vazio e se o campo de nomeação existe
        if (Object.keys(employee).length > 0 && employee.hasOwnProperty(filenameField)) {
            let updatedSvg = generateUpdatedSvg(employee);
            let filename = employee[filenameField] + '-' + (index + 1) + '.svg';
            var blob = new Blob([updatedSvg], {type: "image/svg+xml;charset=utf-8"});
            saveAs(blob, filename);
        }
    });
});


