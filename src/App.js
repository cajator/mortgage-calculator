import React, { useState, useCallback, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import html2canvas from 'html2canvas';
import './App.css';
import logo from './images/smaller-logo.png';

const pocatecniBanky = [
  { id: 1, nazev: "Komerční banka", sazba: 4.6, aktivni: false, poplatekZaZpracovani: 0 },
  { id: 2, nazev: "ČSOB", sazba: 4.8, aktivni: false, poplatekZaZpracovani: 0 },
  { id: 3, nazev: "Česká spořitelna", sazba: 4.7, aktivni: false, poplatekZaZpracovani: 0 },
  { id: 4, nazev: "UniCredit Bank", sazba: 4.8, aktivni: false, poplatekZaZpracovani: 0 },
  { id: 5, nazev: "Raiffeisenbank", sazba: 4.99, aktivni: false, poplatekZaZpracovani: 0 },
  { id: 6, nazev: "mBank", sazba: 5.29, aktivni: false, poplatekZaZpracovani: 0 },
  { id: 7, nazev: "Oberbank", sazba: 5.29, aktivni: false, poplatekZaZpracovani: 0 },
];

const typyNemovitosti = ["Byt", "Dům", "Pozemek", "Komerční nemovitost"];
const ucelyUveru = ["Koupě", "Výstavba", "Rekonstrukce", "Refinancování"];

const formatMena = (hodnota) => {
  return new Intl.NumberFormat('cs-CZ', { 
    style: 'currency', 
    currency: 'CZK', 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  }).format(Math.round(hodnota));
};

const GrafRozlozeniSplatek = React.forwardRef(({ harmonogram, nastavAktualniMesic }, ref) => {
  const data = harmonogram.map(mesic => ({
    mesic: mesic.mesic,
    urok: mesic.platbaUroku / (mesic.platbaUroku + mesic.platbaJistiny),
    jistina: mesic.platbaJistiny / (mesic.platbaUroku + mesic.platbaJistiny)
  }));

  const zpracujKlik = (data) => {
    if (data && data.activePayload && data.activePayload.length) {
      nastavAktualniMesic(data.activePayload[0].payload.mesic);
    }
  };

  return (
    <div className="graf-rozlozeni-splatek" ref={ref}>
      <h4>Rozložení splátek v čase</h4>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} onClick={zpracujKlik}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="mesic" />
          <YAxis tickFormatter={(hodnota) => `${(hodnota * 100).toFixed(0)}%`} />
          <Tooltip 
            formatter={(hodnota, nazev) => [`${(hodnota * 100).toFixed(2)}%`, nazev === 'urok' ? 'Úrok' : 'Jistina']}
            labelFormatter={(popisek) => `Měsíc: ${popisek}`}
          />
          <Legend />
          <Area type="monotone" dataKey="urok" stackId="1" stroke="#8884d8" fill="#8884d8" name="Úrok" />
          <Area type="monotone" dataKey="jistina" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Jistina" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

const HypotecniKalkulator = () => {
  const [celkovyZamer, nastavCelkovyZamer] = useState(3000000);
  const [vlastniZdroje, nastavVlastniZdroje] = useState(600000);
  const [vyseUveru, nastavVysiUveru] = useState(2400000);
  const [dobaUveru, nastavDobuUveru] = useState(30);
  const [dobaFixace, nastavDobuFixace] = useState(5);
  const [referencniSazba, nastavReferencniSazbu] = useState(4.7);
  const [typNemovitosti, nastavTypNemovitosti] = useState(typyNemovitosti[0]);
  const [ucelUveru, nastavUcelUveru] = useState(ucelyUveru[0]);
  const [jmenoKlienta, nastavJmenoKlienta] = useState("");
  const [prijem, nastavPrijem] = useState(50000);
  const [banky, nastavBanky] = useState(pocatecniBanky);
  const [vysledky, nastavVysledky] = useState([]);
  const [rozbalenaBanka, nastavRozbalenouBanku] = useState(null);
  const [porovnaniViceBanek, nastavPorovnaniViceBanek] = useState(false);
  const [poplatekZaZpracovani, nastavPoplatekZaZpracovani] = useState(0);
  const [skrytNazvyBank, nastavSkrytNazvyBank] = useState(false);
  const [aktualniMesic, nastavAktualniMesic] = useState(1);
  const [ulozeneVerze, nastavUlozeneVerze] = useState([]);
  const [nazevVerze, nastavNazevVerze] = useState("");
  const [doplnujiciInformace, nastavDoplnujiciInformace] = useState('');

  const refGrafu = useRef(null);

  useEffect(() => {
    const novyUver = Math.max(celkovyZamer - vlastniZdroje, 0);
    nastavVysiUveru(novyUver);
  }, [celkovyZamer, vlastniZdroje]);

  useEffect(() => {
    nastavBanky(banky.map(banka => ({ ...banka, sazba: referencniSazba })));
  }, [referencniSazba]);

  const vypocitejHypoteku = useCallback(() => {
    const bankyKVypoctu = porovnaniViceBanek ? banky.filter(banka => banka.aktivni) : [{ nazev: "Obecná kalkulace", sazba: referencniSazba, aktivni: true, poplatekZaZpracovani: poplatekZaZpracovani }];
    const noveVysledky = bankyKVypoctu.map(banka => {
      const urokovaSazba = banka.sazba / 100;
      const mesicniSazba = urokovaSazba / 12;
      const pocetSplatek = dobaUveru * 12;
      const mesicniSplatka = (vyseUveru * mesicniSazba * Math.pow(1 + mesicniSazba, pocetSplatek)) / (Math.pow(1 + mesicniSazba, pocetSplatek) - 1);

      let zbyvajiciJistina = vyseUveru;
      const harmonogram = [];
      let celkoveUroky = 0;
      let celkoveUrokyBehemFixace = 0;

      for (let mesic = 1; mesic <= pocetSplatek; mesic++) {
        const platbaUroku = zbyvajiciJistina * mesicniSazba;
        const platbaJistiny = mesicniSplatka - platbaUroku;
        zbyvajiciJistina -= platbaJistiny;
        celkoveUroky += platbaUroku;

        if (mesic <= dobaFixace * 12) {
          celkoveUrokyBehemFixace += platbaUroku;
        }

        harmonogram.push({
          mesic,
          splatka: mesicniSplatka,
          platbaUroku,
          platbaJistiny,
          zbyvajiciJistina: Math.max(zbyvajiciJistina, 0)
        });
      }

      const celkemZaplaceno = vyseUveru + celkoveUroky + banka.poplatekZaZpracovani;

      return {
        banka: banka.nazev,
        mesicniSplatka,
        celkoveUrokyBehemFixace,
        celkoveUroky,
        celkemZaplaceno,
        harmonogram,
        fixace: dobaFixace,
        sazba: banka.sazba,
        poplatekZaZpracovani: banka.poplatekZaZpracovani
      };
    });

    nastavVysledky(noveVysledky);
  }, [vyseUveru, dobaUveru, dobaFixace, referencniSazba, banky, porovnaniViceBanek, poplatekZaZpracovani]);

  const prepniBanku = (id) => {
    nastavBanky(banky.map(banka => 
      banka.id === id ? { ...banka, aktivni: !banka.aktivni } : banka
    ));
  };

  const aktualizujSazbuBanky = (id, novaSazba) => {
    nastavBanky(banky.map(banka => 
      banka.id === id ? { ...banka, sazba: parseFloat(novaSazba) } : banka
    ));
  };

  const aktualizujPoplatekBanky = (id, novyPoplatek) => {
    nastavBanky(banky.map(banka => 
      banka.id === id ? { ...banka, poplatekZaZpracovani: parseFloat(novyPoplatek) } : banka
    ));
  };

  const ulozVerzi = () => {
    if (nazevVerze.trim() === "") {
      alert("Prosím zadejte název verze.");
      return;
    }
    const novaVerze = {
      nazev: nazevVerze,
      datum: new Date().toLocaleString(),
      parametry: {
        celkovyZamer,
        vlastniZdroje,
        vyseUveru,
        dobaUveru,
        dobaFixace,
        referencniSazba,
        typNemovitosti,
        ucelUveru,
        jmenoKlienta,
        prijem,
        banky,
        porovnaniViceBanek,
        poplatekZaZpracovani
      },
      vysledky
    };
    nastavUlozeneVerze([...ulozeneVerze, novaVerze]);
    nastavNazevVerze("");
  };

  const nactiVerzi = (verze) => {
    nastavCelkovyZamer(verze.parametry.celkovyZamer);
    nastavVlastniZdroje(verze.parametry.vlastniZdroje);
    nastavVysiUveru(verze.parametry.vyseUveru);
    nastavDobuUveru(verze.parametry.dobaUveru);
    nastavDobuFixace(verze.parametry.dobaFixace);
    nastavReferencniSazbu(verze.parametry.referencniSazba);
    nastavTypNemovitosti(verze.parametry.typNemovitosti);
    nastavUcelUveru(verze.parametry.ucelUveru);
    nastavJmenoKlienta(verze.parametry.jmenoKlienta);
    nastavPrijem(verze.parametry.prijem);
    nastavBanky(verze.parametry.banky);
    nastavPorovnaniViceBanek(verze.parametry.porovnaniViceBanek);
    nastavPoplatekZaZpracovani(verze.parametry.poplatekZaZpracovani);
    nastavVysledky(verze.vysledky);
  };

  const exportujDoPDF = async () => {
    const doc = new jsPDF();

    doc.addFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto');
   
    // Zmenšené logo
    doc.addImage(logo, 'PNG', 170, 10, 25, 25);

    doc.setFontSize(16);
    doc.text("Výsledky hypoteční kalkulačky", 14, 30);

    doc.setFontSize(10);

    const zakladniInfo = [
      `Celkový záměr: ${formatMena(celkovyZamer)}`,
      `Vlastní zdroje: ${formatMena(vlastniZdroje)}`,
      `Výše úvěru: ${formatMena(vyseUveru)}`,
      `Klient: ${jmenoKlienta}`,
      `Datum: ${new Date().toLocaleDateString()}`,
      `Účel úvěru: ${ucelUveru}`,
      `Typ nemovitosti: ${typNemovitosti}`,
      `Doba splácení: ${dobaUveru} let`,
      `Fixace: ${dobaFixace} let`,
      `Referenční sazba: ${referencniSazba}%`,       
      `Příjem: ${formatMena(prijem)}`,
    ];
  
    let yPozice = 40;
    zakladniInfo.forEach(info => {
      doc.text(info, 14, yPozice);
      yPozice += 6;
    });
  
    const dataDoTabulky = vysledky.map((vysledek, index) => [
      skrytNazvyBank ? `Varianta ${index + 1}` : vysledek.banka,
      formatMena(vysledek.mesicniSplatka),
      formatMena(vysledek.celkoveUrokyBehemFixace),
      formatMena(vysledek.celkoveUroky),
      formatMena(vysledek.celkemZaplaceno),
      `${vysledek.fixace} let`,
      `${vysledek.sazba}%`,
      formatMena(vysledek.poplatekZaZpracovani)
    ]);
  
    doc.autoTable({
      head: [['Banka', 'Měsíční splátka', 'Úroky za fixaci', 'Celkové úroky', 'Celkem zaplaceno', 'Fixace', 'Sazba', 'Náklady na zpracování']],
      body: dataDoTabulky,
      startY: yPozice + 5,
      styles: { font: 'Roboto', fontSize: 8 },
      headStyles: { fillColor: [74, 144, 226] },
    });
  
    if (refGrafu.current && vysledky.length > 0) {
      const platno = await html2canvas(refGrafu.current);
      const imgData = platno.toDataURL('image/png');
      const imgSirka = 180;
      const imgVyska = (platno.height * imgSirka) / platno.width;
  
      const vyskaPDF = doc.internal.pageSize.height;
      let novaPoziceY = doc.lastAutoTable.finalY + 10;
  
      if (novaPoziceY + imgVyska > vyskaPDF - 20) {
        doc.addPage();
        novaPoziceY = 20;
      }
  
      doc.addImage(imgData, 'PNG', 15, novaPoziceY, imgSirka, imgVyska);
      
      // Přidání doplňujících informací, pokud je místo
      if (doplnujiciInformace.trim() !== '') {
        const dostupneMisto = vyskaPDF - (novaPoziceY + imgVyska + 30); // 30 je buffer pro zápatí
        doc.setFontSize(10);
        const rozdelenyText = doc.splitTextToSize(doplnujiciInformace, doc.internal.pageSize.width - 30);
        
        if (dostupneMisto >= rozdelenyText.length * 5) { // Přibližná výška textu
          doc.text("Doplňující informace:", 15, novaPoziceY + imgVyska + 10);
          doc.text(rozdelenyText, 15, novaPoziceY + imgVyska + 20);
        } else {
          doc.addPage();
          doc.text("Doplňující informace:", 15, 20);
          doc.text(rozdelenyText, 15, 30);
        }
      }
    }
  
    const zapati = "Výše RPSN a celková splatná částka, mají pouze informativní charakter a vychází z předpokladů nákladů v kalkulaci. Reprezentativní příklad: Výše úvěru 2 500 000 Kč, doba trvání 30 let, celkový počet splátek 360, měsíční splátka 14 764 Kč, pevná úroková sazba po dobu 3 let 5,86 % p.a., RPSN 6,61 %, celková částka splatná spotřebitelem 5 315 215 Kč. Pro výpočet se neuvažuje s dalšími náklady, které by mohli vzniknout (poplatky za ověření, pojištění nemovitosti, návrhy na vklad do KN apod.)";
  
    const pridejZapati = (doc) => {
      const stranka = doc.internal.getNumberOfPages();
      const sirkaStrany = doc.internal.pageSize.width;
      doc.setFontSize(8);
      const rozdelenyText = doc.splitTextToSize(zapati, sirkaStrany - 20);
      doc.text(rozdelenyText, 10, doc.internal.pageSize.height - 20);
    };
  
    const pocetStranek = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pocetStranek; i++) {
      doc.setPage(i);
      pridejZapati(doc);
    }
  
    doc.save("hypotecni-kalkulacka-vysledky.pdf");
  };

  return (
    <div className="hypotecni-kalkulator">
      <main>
        <section className="sekce-zakladni-udaje">
          <h2>Základní údaje</h2>
          <div className="mrizka-vstupu">
            <div className="skupina-vstupu">
              <label htmlFor="celkovy-zamer">Celkový záměr (Kč):</label>
              <input 
                id="celkovy-zamer"
                type="number" 
                value={celkovyZamer} 
                onChange={(e) => nastavCelkovyZamer(Number(e.target.value))} 
              />
            </div>
            <div className="skupina-vstupu">
              <label htmlFor="vlastni-zdroje">Vlastní zdroje (Kč):</label>
              <input 
                id="vlastni-zdroje"
                type="number" 
                value={vlastniZdroje} 
                onChange={(e) => nastavVlastniZdroje(Number(e.target.value))} 
              />
            </div>
            <div className="skupina-vstupu">
              <label htmlFor="vyse-uveru">Výše úvěru (Kč):</label>
              <input 
                id="vyse-uveru"
                type="number" 
                value={vyseUveru} 
                readOnly 
              />
            </div>
          </div>
        </section>

        <section className="sekce-parametry">
          <h2>Parametry hypotéky</h2>
          <div className="parametry-mrizka">
            <div className="skupina-vstupu">
              <label htmlFor="doba-uveru">Doba splácení (roky):</label>
              <input 
                id="doba-uveru"
                type="number" 
                value={dobaUveru} 
                onChange={(e) => nastavDobuUveru(Number(e.target.value))} 
              />
            </div>
            <div className="skupina-vstupu">
              <label htmlFor="doba-fixace">Fixace (roky):</label>
              <input 
                id="doba-fixace"
                type="number" 
                value={dobaFixace} 
                onChange={(e) => nastavDobuFixace(Number(e.target.value))} 
              />
            </div>
            <div className="skupina-vstupu">
              <label htmlFor="referencni-sazba">Referenční sazba (%):</label>
              <input 
                id="referencni-sazba"
                type="number" 
                step="0.01" 
                value={referencniSazba} 
                onChange={(e) => nastavReferencniSazbu(Number(e.target.value))} 
              />
            </div>
            <div className="skupina-vstupu">
              <label htmlFor="typ-nemovitosti">Typ nemovitosti:</label>
              <select
                id="typ-nemovitosti"
                value={typNemovitosti}
                onChange={(e) => nastavTypNemovitosti(e.target.value)}
              >
                {typyNemovitosti.map(typ => (
                  <option key={typ} value={typ}>{typ}</option>
                ))}
              </select>
            </div>
            <div className="skupina-vstupu">
              <label htmlFor="ucel-uveru">Účel úvěru:</label>
              <select
                id="ucel-uveru"
                value={ucelUveru}
                onChange={(e) => nastavUcelUveru(e.target.value)}
              >
                {ucelyUveru.map(ucel => (
                  <option key={ucel} value={ucel}>{ucel}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="info-klienta">
          <h2>Informace o klientovi</h2>
          <div className="mrizka-vstupu">
            <div className="skupina-vstupu">
              <label htmlFor="jmeno-klienta">Jméno klienta:</label>
              <input 
                id="jmeno-klienta"
                type="text" 
                value={jmenoKlienta} 
                onChange={(e) => nastavJmenoKlienta(e.target.value)} 
              />
            </div>
            <div className="skupina-vstupu">
              <label htmlFor="prijem">Čisté příjmy žadatelů (Kč/měsíc):</label>
              <input 
                id="prijem"
                type="number" 
                value={prijem} 
                onChange={(e) => nastavPrijem(Number(e.target.value))} 
              />
            </div>
          </div>
        </section>

        <section className="nastaveni-porovnani">
          <div className="skupina-vstupu">
            <label>
              <input
                type="checkbox"
                checked={porovnaniViceBanek}
                onChange={() => nastavPorovnaniViceBanek(!porovnaniViceBanek)}
              />
              Srovnání více bank
            </label>
          </div>
          {!porovnaniViceBanek && (
            <div className="skupina-vstupu">
              <label htmlFor="poplatek-za-zpracovani">Náklady na zpracování (Kč):</label>
              <input 
                id="poplatek-za-zpracovani"
                type="number" 
                value={poplatekZaZpracovani} 
                onChange={(e) => nastavPoplatekZaZpracovani(Number(e.target.value))} 
              />
            </div>
          )}
        </section>

        {porovnaniViceBanek && (
          <section className="sekce-nastaveni-bank">
            <h2>Nastavení bank</h2>
            <div className="mrizka-nastaveni-bank">
              {banky.map(banka => (
                <div key={banka.id} className="nastaveni-banky">
                  <label className="prepinac">
                    <input
                      type="checkbox"
                      checked={banka.aktivni}
                      onChange={() => prepniBanku(banka.id)}
                    />
                    <span className="posuvnik"></span>
                  </label>
                  <span className="nazev-banky">{banka.nazev}</span>
                  <div className="vstupy-banky">
                    <input
                      type="number"
                      step="0.01"
                      value={banka.sazba}
                      onChange={(e) => aktualizujSazbuBanky(banka.id, e.target.value)}
                      disabled={!banka.aktivni}
                      placeholder="Sazba (%)"
                      className="vstup-sazby-banky"
                    />
                    <input
                      type="number"
                      value={banka.poplatekZaZpracovani}
                      onChange={(e) => aktualizujPoplatekBanky(banka.id, e.target.value)}
                      disabled={!banka.aktivni}
                      placeholder="Poplatek (Kč)"
                      className="vstup-poplatku-banky"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <button className="tlacitko-vypocet" onClick={vypocitejHypoteku}>Vypočítat</button>

        {vysledky.length > 0 && (
          <section className="sekce-vysledku">
            <h2>Výsledky</h2>
            <div className="mrizka-vysledku">
              {vysledky.map((vysledek, index) => (
                <div key={index} className="karta-vysledku">
                  <h3>{vysledek.banka}</h3>
                  <p>Měsíční splátka: <strong>{formatMena(vysledek.mesicniSplatka)}</strong></p>
                  <p>Úroky za dobu fixace: <strong>{formatMena(vysledek.celkoveUrokyBehemFixace)}</strong></p>
                  <p>Celkové úroky: <strong>{formatMena(vysledek.celkoveUroky)}</strong></p>
                  <p>Celkem zaplaceno: <strong>{formatMena(vysledek.celkemZaplaceno)}</strong></p>
                  <p>Fixace: <strong>{vysledek.fixace} let</strong></p>
                  <p>Sazba: <strong>{vysledek.sazba}%</strong></p>
                  <button onClick={() => nastavRozbalenouBanku(rozbalenaBanka === index ? null : index)}>
                    {rozbalenaBanka === index ? 'Skrýt detail' : 'Zobrazit detail'}
                  </button>
                </div>
              ))}
            </div>
            {rozbalenaBanka !== null && (
              <div className="rozsirene-detaily">
                <input
                  type="range"
                  min="1"
                  max={dobaUveru * 12}
                  value={aktualniMesic}
                  onChange={(e) => nastavAktualniMesic(Number(e.target.value))}
                  className="posuvnik-mesicu"
                />
                <p>Měsíc: {aktualniMesic}</p>
                <table className="tabulka-detailu">
                  <thead>
                    <tr>
                      <th>Měsíc</th>
                      <th>Splátka</th>
                      <th>Úrok</th>
                      <th>Jistina</th>
                      <th>Zbývá splatit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vysledky[rozbalenaBanka].harmonogram.slice(aktualniMesic - 1, aktualniMesic).map((mesic, i) => (
                      <tr key={i}>
                        <td>{mesic.mesic}</td>
                        <td>{formatMena(mesic.splatka)}</td>
                        <td>{formatMena(mesic.platbaUroku)}</td>
                        <td>{formatMena(mesic.platbaJistiny)}</td>
                        <td>{formatMena(mesic.zbyvajiciJistina)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <GrafRozlozeniSplatek 
                  ref={refGrafu} 
                  harmonogram={vysledky[rozbalenaBanka].harmonogram}
                  nastavAktualniMesic={nastavAktualniMesic}
                />
              </div>
            )}
            <div className="moznosti-exportu">
              <label>
                <input
                  type="checkbox"
                  checked={skrytNazvyBank}
                  onChange={(e) => nastavSkrytNazvyBank(e.target.checked)}
                />
                Skrýt názvy bank v PDF (použít Varianta 1, 2,3...)
              </label>
            </div>
            <button className="tlacitko-export" onClick={exportujDoPDF}>Exportovat do PDF</button>
          </section>
        )}

        <section className="sekce-doplnujici-informace">
          <h2>Doplňující informace</h2>
          <textarea
            value={doplnujiciInformace}
            onChange={(e) => nastavDoplnujiciInformace(e.target.value)}
            rows="4"
            placeholder="Zadejte doplňující informace..."
          />
        </section>

        <section className="sekce-ulozeni-verze">
          <h2>Uložení verze kalkulace</h2>
          <div className="skupina-vstupu">
            <label htmlFor="nazev-verze">Název verze:</label>
            <input 
              id="nazev-verze"
              type="text" 
              value={nazevVerze} 
              onChange={(e) => nastavNazevVerze(e.target.value)} 
            />
          </div>
          <button className="tlacitko-ulozit" onClick={ulozVerzi}>Uložit verzi</button>
        </section>

        <section className="sekce-ulozene-verze">
          <h2>Uložené verze kalkulací</h2>
          <ul className="seznam-verzi">
            {ulozeneVerze.map((verze, index) => (
              <li key={index}>
                <span>{verze.nazev} - {verze.datum}</span>
                <button onClick={() => nactiVerzi(verze)}>Načíst</button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default HypotecniKalkulator;