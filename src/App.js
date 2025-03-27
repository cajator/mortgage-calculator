import React, { useState, useCallback, useEffect, useRef } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import html2canvas from 'html2canvas';
import './App.css';
import logo from './images/smaller-logo.png';

// Správná funkce pro výpočet pojištění České spořitelny
const vypocitejPojisteniCS = (mesicniSplatka, typPPI = "standard", variant = "full") => {
  // Podle poskytnuté informace se pojištění ČS počítá jako procento z měsíční splátky:
  // PPI Standard plné: splátka * 9,26%
  // PPI Standard 50%: splátka * 5,47%
  
  let sazba;
  
  if (typPPI === "standard") {
    sazba = variant === "full" ? 0.0926 : 0.0547; // PPI Standard (plné nebo 50%)
  } else {
    // Pro PPI Plus použijeme stejný poměr jako v původních sazbách (PPI Plus je vyšší než Standard)
    sazba = variant === "full" ? 0.1055 : 0.0673; // PPI Plus (plné nebo 50%)
  }
  
  const mesicniPojistne = Math.round(mesicniSplatka * sazba);
  
  return mesicniPojistne;
};

// Pomocná funkce pro odhad splátky pro výpočet pojištění ČS v UI
const odhadniSplatkuProPojisteni = (vyseUveru, urokovaSazba, dobaUveru, typPPI, variantaPPI) => {
  // Nejprve odhadneme splátku
  const rocniSazba = (urokovaSazba / 100 * 365) / 360;
  const mesicniSazba = rocniSazba / 12;
  const pocetSplatek = dobaUveru * 12;
  
  // Výpočet měsíční splátky
  const odhadovanaSplatka = Math.ceil((vyseUveru * mesicniSazba * Math.pow(1 + mesicniSazba, pocetSplatek)) 
                            / (Math.pow(1 + mesicniSazba, pocetSplatek) - 1));
  
  // Nyní vypočítáme pojistné
  return vypocitejPojisteniCS(odhadovanaSplatka, typPPI, variantaPPI);
};

// Funkce pro výpočet pojištění UniCredit Bank
const vypocitejPojisteniUCB = (vyseUveru, urokovaSazba, dobaUveru, dobaFixace) => {
  // UCB: navýšení úvěru o 3% (tzn. z 4 mil. na 4,12 mil.)
  
  const navyseniUveru = 0.03; // 3%
  const navysenyUver = vyseUveru * (1 + navyseniUveru); // např. 4 000 000 * 1.03 = 4 120 000
  
  // Převod roční sazby na měsíční
  const mesicniSazba = (urokovaSazba / 100) / 12;
  const pocetSplatek = dobaUveru * 12;
  
  // Výpočet běžné měsíční splátky
  const beznaSpLatka = Math.round((vyseUveru * mesicniSazba * Math.pow(1 + mesicniSazba, pocetSplatek)) 
                               / (Math.pow(1 + mesicniSazba, pocetSplatek) - 1));
  
  // Výpočet navýšené měsíční splátky
  const navysenaSpLatka = Math.round((navysenyUver * mesicniSazba * Math.pow(1 + mesicniSazba, pocetSplatek)) 
                                  / (Math.pow(1 + mesicniSazba, pocetSplatek) - 1));
  
  // Pojistné je rozdíl těchto splátek
  const pojistne = navysenaSpLatka - beznaSpLatka;
  
  return pojistne;
};

const pocatecniBanky = [
  { 
    id: 1, 
    nazev: "Komerční banka", 
    sazba: 4.6, 
    aktivni: false, 
    poplatekZaZpracovani: 0,
    maPojisteni: false,
    pojisteniMesicne: 0,
    pojisteniTyp: "manual" // "manual" = ruční zadání částky
  },
  { 
    id: 2, 
    nazev: "ČSOB", 
    sazba: 4.8, 
    aktivni: false, 
    poplatekZaZpracovani: 0,
    maPojisteni: false,
    pojisteniMesicne: 0,
    pojisteniTyp: "manual"
  },
  { 
    id: 3, 
    nazev: "Česká spořitelna", 
    sazba: 4.7, 
    aktivni: false, 
    poplatekZaZpracovani: 0,
    maPojisteni: false,
    pojisteniMesicne: 0,
    pojisteniTyp: "cs", // speciální výpočet pro ČS
    pojisteniCSVarianta: "standard", // standard nebo plus
    pojisteniCSTyp: "full" // full nebo half (50%)
  },
  { 
    id: 4, 
    nazev: "UniCredit Bank", 
    sazba: 4.8, 
    aktivni: false, 
    poplatekZaZpracovani: 0,
    maPojisteni: false,
    pojisteniMesicne: 0,
    pojisteniTyp: "manual"
  },
  { 
    id: 5, 
    nazev: "Raiffeisenbank", 
    sazba: 4.99, 
    aktivni: false, 
    poplatekZaZpracovani: 0,
    maPojisteni: false,
    pojisteniMesicne: 0,
    pojisteniTyp: "manual"
  },
  { 
    id: 6, 
    nazev: "mBank", 
    sazba: 5.29, 
    aktivni: false, 
    poplatekZaZpracovani: 0,
    maPojisteni: false,
    pojisteniMesicne: 0,
    pojisteniTyp: "manual"
  },
  { 
    id: 7, 
    nazev: "Oberbank", 
    sazba: 5.29, 
    aktivni: false, 
    poplatekZaZpracovani: 0,
    maPojisteni: false,
    pojisteniMesicne: 0,
    pojisteniTyp: "manual"
  },
];

const typyNemovitosti = ["","Byt", "Dům", "Pozemek", "Komerční nemovitost"];
const ucelyUveru = ["","Koupě", "Výstavba", "Rekonstrukce", "Refinancování", "Bez účelu"];

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

// Aktualizovaná komponenta pro souhrn plateb za fixační období včetně pojištění
const SouhrnFixacnihoObdobi = React.forwardRef(({ vysledek }, ref) => {
  if (!vysledek || !vysledek.harmonogram) return null;
  
  const mesiceFixace = vysledek.fixace * 12;
  const harmonogramFixace = vysledek.harmonogram.slice(0, mesiceFixace);
  
  const celkovaSplatka = harmonogramFixace.reduce((sum, mesic) => sum + mesic.splatka, 0);
  const celkovaJistina = harmonogramFixace.reduce((sum, mesic) => sum + mesic.platbaJistiny, 0);
  const celkoveUroky = harmonogramFixace.reduce((sum, mesic) => sum + mesic.platbaUroku, 0);
  const celkovePojisteni = vysledek.maPojisteni ? 
    harmonogramFixace.reduce((sum, mesic) => sum + mesic.pojisteni, 0) : 0;
  const celkovePlatby = celkovaSplatka + celkovePojisteni;
  
  return (
    <div className="souhrn-fixace" ref={ref}>
      <h4>Souhrn plateb za fixační období ({vysledek.fixace} let)</h4>
      <div className="fixace-prehled">
        <div className="fixace-polozka">
          <span>Celkem zaplaceno na úvěru:</span>
          <strong>{formatMena(celkovaSplatka)}</strong>
        </div>
        <div className="fixace-polozka">
          <span>Zaplaceno na jistině:</span>
          <strong>{formatMena(celkovaJistina)}</strong>
        </div>
        <div className="fixace-polozka">
          <span>Zaplaceno na úrocích:</span>
          <strong>{formatMena(celkoveUroky)}</strong>
        </div>
        
        {vysledek.maPojisteni && (
          <div className="fixace-polozka">
            <span>Zaplaceno na pojištění:</span>
            <strong>{formatMena(celkovePojisteni)}</strong>
          </div>
        )}
        
        {vysledek.maPojisteni && (
          <div className="fixace-polozka">
            <span>Celkem zaplaceno (úvěr + pojištění):</span>
            <strong className="celkova-splatka">{formatMena(celkovePlatby)}</strong>
          </div>
        )}
        
        <div className="fixace-polozka">
          <span>Zbývající jistina po fixaci:</span>
          <strong>{formatMena(harmonogramFixace[harmonogramFixace.length - 1].zbyvajiciJistina)}</strong>
        </div>
      </div>
    </div>
  );
});

const HypotecniKalkulator = () => {
  const [celkovyZamer, nastavCelkovyZamer] = useState(4000000);
  const [vlastniZdroje, nastavVlastniZdroje] = useState(0); // Výchozí hodnota změněna na 0
  const [vyseUveru, nastavVysiUveru] = useState(4000000); // Aktualizováno podle výchozích hodnot
  const [dobaUveru, nastavDobuUveru] = useState(30);
  const [dobaFixace, nastavDobuFixace] = useState(3);
  const [referencniSazba, nastavReferencniSazbu] = useState(4.7);
  const [typNemovitosti, nastavTypNemovitosti] = useState(typyNemovitosti[0]);
  const [ucelUveru, nastavUcelUveru] = useState(ucelyUveru[0]);
  const [jmenoKlienta, nastavJmenoKlienta] = useState("");
  const [prijmeniKlienta, nastavPrijmeniKlienta] = useState(""); // Nové pole pro příjmení
  const [prijem, nastavPrijem] = useState("");
  const [rozsireneInfoKlienta, nastavRozsireneInfoKlienta] = useState(false); // Toggle pro zobrazení rozšířených informací
  const [telefonKlienta, nastavTelefonKlienta] = useState(""); // Nové pole pro telefon
  const [emailKlienta, nastavEmailKlienta] = useState(""); // Nové pole pro email
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
  const [tisknoutRozsireneInfoKlienta, nastavTisknoutRozsireneInfoKlienta] = useState(false); // Pro PDF export

  const refGrafu = useRef(null);
  const refSouhrnuFixace = useRef(null);

  useEffect(() => {
    const novyUver = Math.max(celkovyZamer - vlastniZdroje, 0);
    nastavVysiUveru(novyUver);
  }, [celkovyZamer, vlastniZdroje]);

  useEffect(() => {
    nastavBanky(banky.map(banka => ({ ...banka, sazba: referencniSazba })));
  }, [referencniSazba]);

  // Funkce pro aktualizaci stavu pojištění u banky
  const aktualizujPojisteniStav = (id, maPojisteni) => {
    nastavBanky(banky.map(banka => 
      banka.id === id ? { ...banka, maPojisteni } : banka
    ));
  };

  // Funkce pro aktualizaci výše pojištění u banky
  const aktualizujVysiPojisteni = (id, pojisteniMesicne) => {
    nastavBanky(banky.map(banka => 
      banka.id === id ? { ...banka, pojisteniMesicne: parseFloat(pojisteniMesicne) || 0 } : banka
    ));
  };

  // Funkce pro aktualizaci varianty pojištění ČS (standard/plus)
  const aktualizujPojisteniCSVariantu = (id, varianta) => {
    nastavBanky(banky.map(banka => 
      banka.id === id ? { ...banka, pojisteniCSVarianta: varianta } : banka
    ));
  };

  // Funkce pro aktualizaci typu pojištění ČS (full/half)
  const aktualizujPojisteniCSTyp = (id, typ) => {
    nastavBanky(banky.map(banka => 
      banka.id === id ? { ...banka, pojisteniCSTyp: typ } : banka
    ));
  };

  const vypocitejHypoteku = useCallback(() => {
    const bankyKVypoctu = porovnaniViceBanek 
      ? banky.filter(banka => banka.aktivni) 
      : [{ 
          nazev: "Obecná kalkulace", 
          sazba: referencniSazba, 
          aktivni: true, 
          poplatekZaZpracovani: poplatekZaZpracovani,
          maPojisteni: false,
          pojisteniMesicne: 0,
          pojisteniTyp: "manual"
        }];
    
    const noveVysledky = bankyKVypoctu.map(banka => {
      let mesicniSplatka;
      let urokovaSazba = Math.round(banka.sazba * 100) / 10000;
      
      if (banka.nazev === "Česká spořitelna") {
        // Upravený výpočet pro Českou spořitelnu podle vzorce (sazba*365/360)/12
        const rocniSazba = (urokovaSazba * 365) / 360;
        const mesicniSazba = rocniSazba / 12;
        const pocetSplatek = dobaUveru * 12;
        
        const citatel = mesicniSazba * Math.pow(1 + mesicniSazba, pocetSplatek);
        const jmenovatel = Math.pow(1 + mesicniSazba, pocetSplatek) - 1;
        mesicniSplatka = vyseUveru * (citatel / jmenovatel);
        
        mesicniSplatka = Math.ceil(mesicniSplatka);
      } else {
        const mesicniSazba = urokovaSazba / 12;
        const pocetSplatek = dobaUveru * 12;
        mesicniSplatka = Math.round((vyseUveru * mesicniSazba * Math.pow(1 + mesicniSazba, pocetSplatek)) / (Math.pow(1 + mesicniSazba, pocetSplatek) - 1));
      }

      // Výpočet pojištění
      let pojisteniMesicne = 0;
      if (banka.maPojisteni) {
        if (banka.pojisteniTyp === "cs") {
          // Pojištění ČS je procento ze splátky, takže ho počítáme až po výpočtu splátky
          pojisteniMesicne = vypocitejPojisteniCS(mesicniSplatka, banka.pojisteniCSVarianta, banka.pojisteniCSTyp);
        } else if (banka.pojisteniTyp === "ucb") {
          pojisteniMesicne = vypocitejPojisteniUCB(vyseUveru, banka.sazba, dobaUveru, dobaFixace);
        } else {
          pojisteniMesicne = banka.pojisteniMesicne;
        }
      }

      // Přidání pojištění k měsíční splátce
      const celkovaMesicniSplatka = mesicniSplatka + pojisteniMesicne;

      let zbyvajiciJistina = vyseUveru;
      const harmonogram = [];
      let celkoveUrokyBehemFixace = 0;
      let celkovePojisteniBehemFixace = 0;

      for (let mesic = 1; mesic <= dobaUveru * 12; mesic++) {
        let platbaUroku;
        
        if (banka.nazev === "Česká spořitelna") {
          // Upravený výpočet úroku pro Českou spořitelnu
          const rocniSazba = (urokovaSazba * 365) / 360;
          const mesicniSazba = rocniSazba / 12;
          platbaUroku = Math.round(zbyvajiciJistina * mesicniSazba);
        } else {
          const mesicniSazba = urokovaSazba / 12;
          platbaUroku = Math.round(zbyvajiciJistina * mesicniSazba);
        }
        
        const platbaJistiny = mesicniSplatka - platbaUroku;
        zbyvajiciJistina -= platbaJistiny;

        if (mesic <= dobaFixace * 12) {
          celkoveUrokyBehemFixace += platbaUroku;
          celkovePojisteniBehemFixace += pojisteniMesicne;
        }

        harmonogram.push({
          mesic,
          splatka: mesicniSplatka,
          pojisteni: pojisteniMesicne,
          celkovaSplatka: celkovaMesicniSplatka,
          platbaUroku,
          platbaJistiny,
          zbyvajiciJistina: Math.max(zbyvajiciJistina, 0)
        });
      }

      return {
        banka: banka.nazev,
        mesicniSplatka,
        pojisteniMesicne,
        celkovaMesicniSplatka,
        celkoveUrokyBehemFixace,
        celkovePojisteniBehemFixace,
        harmonogram,
        fixace: dobaFixace,
        sazba: banka.sazba,
        poplatekZaZpracovani: banka.poplatekZaZpracovani,
        maPojisteni: banka.maPojisteni
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
        prijmeniKlienta,
        prijem,
        telefonKlienta,
        emailKlienta,
        banky,
        porovnaniViceBanek,
        poplatekZaZpracovani
      },
      vysledky
    };
    nastavUlozeneVerze([...ulozeneVerze, novaVerze]);
    nastavNazevVerze("");
    alert(`Verze "${nazevVerze}" byla úspěšně uložena.`);
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
    // Načtení nových polí, pokud existují
    if (verze.parametry.prijmeniKlienta !== undefined) nastavPrijmeniKlienta(verze.parametry.prijmeniKlienta);
    if (verze.parametry.telefonKlienta !== undefined) nastavTelefonKlienta(verze.parametry.telefonKlienta);
    if (verze.parametry.emailKlienta !== undefined) nastavEmailKlienta(verze.parametry.emailKlienta);
    nastavPrijem(verze.parametry.prijem);
    nastavBanky(verze.parametry.banky);
    nastavPorovnaniViceBanek(verze.parametry.porovnaniViceBanek);
    nastavPoplatekZaZpracovani(verze.parametry.poplatekZaZpracovani);
    nastavVysledky(verze.vysledky);
    alert(`Verze "${verze.nazev}" byla úspěšně načtena.`);
  };

  const odstranitVerzi = (index) => {
    if (window.confirm("Opravdu chcete odstranit tuto verzi?")) {
      const noveVerze = [...ulozeneVerze];
      noveVerze.splice(index, 1);
      nastavUlozeneVerze(noveVerze);
    }
  };

  const exportujDoPDF = async () => {
    const doc = new jsPDF();

    doc.addFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto');
   
    doc.addImage(logo, 'PNG', 170, 10, 25, 25);

    doc.setFontSize(16);
    doc.text("Výsledky hypoteční kalkulačky", 14, 20);

    doc.setFontSize(10);

    // Sestavení základních informací
    const zakladniInfo = [
      `Klient: ${jmenoKlienta} ${prijmeniKlienta}`,
    ];

    // Přidání rozšířených informací o klientovi, pokud je zapnuto
    if (tisknoutRozsireneInfoKlienta) {
      zakladniInfo.push(
        `Telefon: ${telefonKlienta}`,
        `Email: ${emailKlienta}`,
        `Příjem: ${formatMena(prijem)}`
      );
    }

    // Přidání dalších základních informací
    zakladniInfo.push(
      `Účel úvěru: ${ucelUveru}`,
      `Typ nemovitosti: ${typNemovitosti}`,
      `Celkový záměr: ${formatMena(celkovyZamer)}`,
      `Vlastní zdroje: ${formatMena(vlastniZdroje)}`,
      `Výše úvěru: ${formatMena(vyseUveru)}`,
      `Doba splácení: ${dobaUveru} let`,
      `Fixace: ${dobaFixace} let`,
      '',
      `Datum: ${new Date().toLocaleDateString()}`
    );
  
    let yPozice = 45;
    zakladniInfo.forEach(info => {
      const casti = info.split(':');
      if (casti.length === 2) {
        doc.text(casti[0] + ":", 14, yPozice);
        doc.text(" " + casti[1].trim(), 45, yPozice);
      } else {
        doc.text(info, 14, yPozice);
      }
      yPozice += 6;
    });
  
  // Přidání souhrnných údajů o platbách za fixaci do tabulky
  const dataDoTabulky = vysledky.map((vysledek, index) => {
    // Vypočítáme souhrn fixačního období pro každý výsledek
    const mesiceFixace = vysledek.fixace * 12;
    const harmonogramFixace = vysledek.harmonogram.slice(0, mesiceFixace);
    
    const celkovaSplatka = harmonogramFixace.reduce((sum, mesic) => sum + mesic.splatka, 0);
    const celkovaJistina = harmonogramFixace.reduce((sum, mesic) => sum + mesic.platbaJistiny, 0);
    const zbyvajiciJistina = harmonogramFixace[harmonogramFixace.length - 1].zbyvajiciJistina;
    const celkovePojisteni = vysledek.maPojisteni ? 
      vysledek.celkovePojisteniBehemFixace : 0;

    return [
      skrytNazvyBank ? `Varianta ${index + 1}` : vysledek.banka,
      formatMena(vysledek.mesicniSplatka),
      vysledek.maPojisteni ? formatMena(vysledek.pojisteniMesicne) : "-",
      vysledek.maPojisteni ? formatMena(vysledek.celkovaMesicniSplatka) : formatMena(vysledek.mesicniSplatka),
      `${vysledek.fixace} let`,
      `${vysledek.sazba.toFixed(2)}%`,
      formatMena(vysledek.poplatekZaZpracovani),
      formatMena(celkovaJistina),
      formatMena(vysledek.celkoveUrokyBehemFixace),
      vysledek.maPojisteni ? formatMena(celkovePojisteni) : "-",
      formatMena(zbyvajiciJistina)
    ];
  });

  doc.autoTable({
    head: [['Banka', 'Měsíční splátka', 'Pojištění', 'Celková splátka', 'Fix', 'Sazba', 'Náklady na zpracování', 'Zaplaceno na jistině', 'Zaplaceno na úrocích', 'Zaplaceno na pojištění za fix', 'Zbývající jistina po fixaci']],
    body: dataDoTabulky,
    startY: yPozice + 5,
    styles: { font: 'Roboto', fontSize: 8 },
    headStyles: { fillColor: [74, 144, 226] },
    // Nastavení šířek sloupců
    columnStyles: {
      0: { cellWidth: 18 }, // Banka
      1: { cellWidth: 'auto' }, // Měsíční splátka
      2: { cellWidth: 'auto' }, // Pojištění
      3: { cellWidth: 'auto' }, // Celková splátka
      4: { cellWidth: 9 }, // Fixace
      5: { cellWidth: 'auto' }, // Sazba
      6: { cellWidth: 14 }, // Náklady na zpracování
      7: { cellWidth: 'auto' }, // Zaplaceno na jistině
      8: { cellWidth: 'auto' }, // Zaplaceno na úrocích
      9: { cellWidth: 18 }, // Zaplaceno na pojištění
      10: { cellWidth: 20 }  // Zbývající jistina po fixaci
    }
  });

  let novaPoziceY = doc.lastAutoTable.finalY + 10;
  
  // Přidání grafu (volitelné)
  if (refGrafu.current && vysledky.length > 0 && !document.getElementById('skip-graph').checked) {
    const platno = await html2canvas(refGrafu.current);
    const imgData = platno.toDataURL('image/png');
    const imgSirka = 180;
    const imgVyska = (platno.height * imgSirka) / platno.width;

    const vyskaPDF = doc.internal.pageSize.height;

    if (novaPoziceY + imgVyska > vyskaPDF - 20) {
      doc.addPage();
      novaPoziceY = 20;
    }

    doc.addImage(imgData, 'PNG', 15, novaPoziceY, imgSirka, imgVyska);
    novaPoziceY += imgVyska + 10;
  }

  // DŮLEŽITÉ: Odstraněn tento blok pro přidání souhrnu fixačního období do PDF
  // Nebude se již tisknout duplicitní souhrn plateb
  
  // Přidání doplňujících informací
  if (doplnujiciInformace.trim() !== '') {
    const vyskaPDF = doc.internal.pageSize.height;
    doc.setFontSize(10);
    const rozdelenyText = doc.splitTextToSize(doplnujiciInformace, doc.internal.pageSize.width - 30);
    
    if (novaPoziceY + (rozdelenyText.length * 5) + 30 > vyskaPDF) {
      doc.addPage();
      novaPoziceY = 20;
    }
    
    doc.text("Doplňující informace:", 15, novaPoziceY + 10);
    doc.text(rozdelenyText, 15, novaPoziceY + 20);
  }

  const zapati = "Výše RPSN a celková splatná částka, mají pouze informativní charakter a vychází z předpokladů nákladů v kalkulaci. Reprezentativní příklad: Výše úvěru 2 500 000 Kč, doba trvání 30 let, celkový počet splátek 360, měsíční splátka 14 764 Kč, pevná úroková sazba po dobu 3 let 5,86 % p.a., RPSN 6,61 %, celková částka splatná spotřebitelem 5 315 215 Kč. Pro výpočet se neuvažuje s dalšími náklady, které by mohli vzniknout (poplatky za ověření, pojištění nemovitosti, návrhy na vklad do KN apod.)";

  const pridejZapati = (doc) => {
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
        <div className="sekce-hlavicka">
          <h2>Informace o klientovi</h2>
          <button 
            className="tlacitko-rozsireni"
            onClick={() => nastavRozsireneInfoKlienta(!rozsireneInfoKlienta)}
          >
            {rozsireneInfoKlienta ? "Skrýt rozšířené informace" : "Zobrazit rozšířené informace"}
          </button>
        </div>
        <div className="mrizka-vstupu">
          <div className="skupina-vstupu">
            <label htmlFor="jmeno-klienta">Jméno:</label>
            <input 
              id="jmeno-klienta"
              type="text" 
              value={jmenoKlienta} 
              onChange={(e) => nastavJmenoKlienta(e.target.value)} 
            />
          </div>
          <div className="skupina-vstupu">
            <label htmlFor="prijmeni-klienta">Příjmení:</label>
            <input 
              id="prijmeni-klienta"
              type="text" 
              value={prijmeniKlienta} 
              onChange={(e) => nastavPrijmeniKlienta(e.target.value)} 
            />
          </div>
        </div>
        
        {rozsireneInfoKlienta && (
          <div className="rozsirene-udaje-klienta">
            <div className="mrizka-vstupu">
              <div className="skupina-vstupu">
                <label htmlFor="telefon-klienta">Telefon:</label>
                <input 
                  id="telefon-klienta"
                  type="text" 
                  value={telefonKlienta} 
                  onChange={(e) => nastavTelefonKlienta(e.target.value)} 
                />
              </div>
              <div className="skupina-vstupu">
                <label htmlFor="email-klienta">Email:</label>
                <input 
                  id="email-klienta"
                  type="email" 
                  value={emailKlienta} 
                  onChange={(e) => nastavEmailKlienta(e.target.value)} 
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
          </div>
        )}
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
                <div className="banka-header">
                  <label className="prepinac">
                    <input
                      type="checkbox"
                      checked={banka.aktivni}
                      onChange={() => prepniBanku(banka.id)}
                    />
                    <span className="posuvnik"></span>
                  </label>
                  <span className="nazev-banky">{banka.nazev}</span>
                </div>
                <div className="banka-body">
                  <div className="banka-input-group">
                    <label htmlFor={`sazba-${banka.id}`}>Sazba (%)</label>
                    <input
                      id={`sazba-${banka.id}`}
                      type="number"
                      step="0.01"
                      value={banka.sazba}
                      onChange={(e) => aktualizujSazbuBanky(banka.id, e.target.value)}
                      disabled={!banka.aktivni}
                    />
                  </div>
                  <div className="banka-input-group">
                    <label htmlFor={`poplatek-${banka.id}`}>Poplatek (Kč)</label>
                    <input
                      id={`poplatek-${banka.id}`}
                      type="number"
                      value={banka.poplatekZaZpracovani}
                      onChange={(e) => aktualizujPoplatekBanky(banka.id, e.target.value)}
                      disabled={!banka.aktivni}
                    />
                  </div>
                  
                  {/* Checkbox pro zapnutí/vypnutí pojištění */}
                  <div className="banka-input-group pojisteni-checkbox">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={banka.maPojisteni}
                        onChange={(e) => aktualizujPojisteniStav(banka.id, e.target.checked)}
                        disabled={!banka.aktivni}
                      />
                      S pojištěním
                    </label>
                  </div>
                  
                  {/* Pole pro pojištění se zobrazí pouze když je pojištění aktivní */}
                  {banka.maPojisteni && (
                    <>
                      {banka.pojisteniTyp === "manual" && (
                        <div className="banka-input-group">
                          <label htmlFor={`pojisteni-${banka.id}`}>Pojištění (Kč/měsíc)</label>
                          <input
                            id={`pojisteni-${banka.id}`}
                            type="number"
                            value={banka.pojisteniMesicne}
                            onChange={(e) => aktualizujVysiPojisteni(banka.id, e.target.value)}
                            disabled={!banka.aktivni}
                          />
                        </div>
                      )}
                      
                      {banka.pojisteniTyp === "cs" && (
                        <div className="banka-input-group pojisteni-cs-konfigurace">
                          <label>Typ pojištění ČS</label>
                          <div className="pojisteni-radio-group">
                            <label className="radio-label">
                              <input
                                type="radio"
                                name={`cs-varianta-${banka.id}`}
                                checked={banka.pojisteniCSVarianta === "standard"}
                                onChange={() => aktualizujPojisteniCSVariantu(banka.id, "standard")}
                                disabled={!banka.aktivni}
                              />
                              PPI Standard
                            </label>
                            <label className="radio-label">
                              <input
                                type="radio"
                                name={`cs-varianta-${banka.id}`}
                                checked={banka.pojisteniCSVarianta === "plus"}
                                onChange={() => aktualizujPojisteniCSVariantu(banka.id, "plus")}
                                disabled={!banka.aktivni}
                              />
                              PPI Plus
                            </label>
                          </div>
                          
                          <div className="pojisteni-radio-group">
                            <label className="radio-label">
                              <input
                                type="radio"
                                name={`cs-typ-${banka.id}`}
                                checked={banka.pojisteniCSTyp === "full"}
                                onChange={() => aktualizujPojisteniCSTyp(banka.id, "full")}
                                disabled={!banka.aktivni}
                              />
                              100% krytí
                            </label>
                            <label className="radio-label">
                              <input
                                type="radio"
                                name={`cs-typ-${banka.id}`}
                                checked={banka.pojisteniCSTyp === "half"}
                                onChange={() => aktualizujPojisteniCSTyp(banka.id, "half")}
                                disabled={!banka.aktivni}
                              />
                              50% krytí
                            </label>
                          </div>
                          
                          <div className="pojisteni-hodnota">
                            {/* Zobrazení odhadované hodnoty pojištění ČS */}
                            Měsíční pojistné: {formatMena(odhadniSplatkuProPojisteni(vyseUveru, banka.sazba, dobaUveru, banka.pojisteniCSVarianta, banka.pojisteniCSTyp))}
                          </div>
                        </div>
                      )}
                      
                      {banka.pojisteniTyp === "ucb" && (
                        <div className="banka-input-group">
                          <div className="pojisteni-info">
                            <label>Pojištění UCB (3%)</label>
                            <span className="pojisteni-hodnota">
                              {formatMena(vypocitejPojisteniUCB(vyseUveru, banka.sazba, dobaUveru, dobaFixace))}/měsíc
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
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
                <p>Měsíční splátka úvěru: <strong>{formatMena(vysledek.mesicniSplatka)}</strong></p>
                
                {vysledek.maPojisteni && (
                  <>
                    <p>Měsíční pojištění: <strong>{formatMena(vysledek.pojisteniMesicne)}</strong></p>
                    <p>Celková měsíční splátka: <strong className="celkova-splatka">{formatMena(vysledek.celkovaMesicniSplatka)}</strong></p>
                  </>
                )}
                
                <p>Úroky za dobu fixace: <strong>{formatMena(vysledek.celkoveUrokyBehemFixace)}</strong></p>
                
                {vysledek.maPojisteni && (
                  <p>Pojištění za dobu fixace: <strong>{formatMena(vysledek.celkovePojisteniBehemFixace)}</strong></p>
                )}
                
                <p>Fixace: <strong>{vysledek.fixace} let</strong></p>
                <p>Sazba: <strong>{vysledek.sazba.toFixed(2)}%</strong></p>
                <button onClick={() => nastavRozbalenouBanku(rozbalenaBanka === index ? null : index)}>
                  {rozbalenaBanka === index ? 'Skrýt detail' : 'Zobrazit detail'}
                </button>
              </div>
            ))}
          </div>
          {rozbalenaBanka !== null && vysledky[rozbalenaBanka] && (
            <div className="rozsirene-detaily">
              <SouhrnFixacnihoObdobi 
                ref={refSouhrnuFixace}
                vysledek={vysledky[rozbalenaBanka]} 
              />
              
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
                    <th>Splátka úvěru</th>
                    {vysledky[rozbalenaBanka].maPojisteni && <th>Pojištění</th>}
                    {vysledky[rozbalenaBanka].maPojisteni && <th>Celkem</th>}
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
                      {vysledky[rozbalenaBanka].maPojisteni && <td>{formatMena(mesic.pojisteni)}</td>}
                      {vysledky[rozbalenaBanka].maPojisteni && <td className="celkova-splatka">{formatMena(mesic.celkovaSplatka)}</td>}
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
              Skrýt názvy bank v PDF (použít Varianta 1, 2, 3...)
            </label>
            <label>
              <input
                type="checkbox"
                id="skip-graph"
                defaultChecked={false}
              />
              Netisknout graf do PDF
            </label>
            <label>
              <input
                type="checkbox"
                checked={tisknoutRozsireneInfoKlienta}
                onChange={(e) => nastavTisknoutRozsireneInfoKlienta(e.target.checked)}
              />
              Zahrnout rozšířené informace o klientovi v PDF
            </label>
          </div>
          
          <div className="sekce-doplnujici-informace">
            <h3>Doplňující informace</h3>
            <textarea
              value={doplnujiciInformace}
              onChange={(e) => nastavDoplnujiciInformace(e.target.value)}
              rows="4"
              placeholder="Zadejte doplňující informace pro PDF..."
            />
          </div>
          
          <button className="tlacitko-export" onClick={exportujDoPDF}>Exportovat do PDF</button>
        </section>
      )}

      <section className="sekce-ulozeni-verze">
        <h2>Uložení a obnovení verzí</h2>
        <div className="ulozeni-verze-panel">
          <div className="ulozeni-input-skupina">
            <input 
              id="nazev-verze"
              type="text" 
              value={nazevVerze} 
              onChange={(e) => nastavNazevVerze(e.target.value)} 
              placeholder="Název verze..."
              className="pole-nazev-verze"
            />
            <button className="tlacitko-ulozit" onClick={ulozVerzi}>Uložit verzi</button>
          </div>
        </div>
        
        <h3>Uložené verze kalkulací</h3>
        {ulozeneVerze.length === 0 ? (
          <p className="zadne-verze">Zatím nemáte žádné uložené verze.</p>
        ) : (
          <ul className="seznam-verzi">
            {ulozeneVerze.map((verze, index) => (
              <li key={index}>
                <div className="info-verze">
                  <span className="nazev-verze">{verze.nazev}</span>
                  <span className="datum-verze">{verze.datum}</span>
                </div>
                <div className="akce-verze">
                  <button onClick={() => nactiVerzi(verze)} className="tlacitko-nacist">Načíst</button>
                  <button onClick={() => odstranitVerzi(index)} className="tlacitko-odstranit">Odstranit</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  </div>
);
};

export default HypotecniKalkulator;