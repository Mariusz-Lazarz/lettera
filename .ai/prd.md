# Dokument wymagań produktu (PRD) - Lettera
## 1. Przegląd produktu

Lettera to aplikacja webowa (MVP) automatyzująca tworzenie listów motywacyjnych (cover letters) na podstawie przesłanego CV użytkownika i opisu ogłoszenia o pracę, wspierana przez modele AI. Celem MVP jest umożliwienie użytkownikowi szybkiego wygenerowania, edycji oraz pobrania listu motywacyjnego w formacie PDF przy minimalnym zestawie funkcji.

## 2. Problem użytkownika

Wielu kandydatów traci czas na ręczne dopasowywanie listów motywacyjnych do konkretnych ofert pracy. Proces jest żmudny, wymaga dostosowania treści i stylu oraz często powtarza się dla różnych aplikacji. Lettera redukuje ten koszt czasu i wysiłku, automatyzując ekstrakcję informacji z CV oraz generowanie listu dostosowanego do treści ogłoszenia.

## 3. Wymagania funkcjonalne

1. Autoryzacja i konto
   - Rejestracja i logowanie przez email i hasło.
   - Profil użytkownika z wykazem przesłanych CV i wygenerowanych listów.
   - Sesje użytkownika minimalnie chronione (podstawowa walidacja i bezpieczne przechowywanie haseł).

2. Upload CV
   - Przyjmwane tylko pliki PDF (limit rozmiaru: kilka MB).
   - Przyjmowane wyłącznie PDF-y zawierające osadzony tekst (tekstowy PDF). Skanowane obrazy bez warstwy tekstowej nie są akceptowane — upload odrzucany z komunikatem.
   - Maksymalnie 5 CV na użytkownika. Nazwy plików numerowane jako cv1..cvN.
   - Walidacja duplikatów (dokładne dopasowanie treści hash) — duplikaty generują błąd i blokują upload.
   - Limit długości nazwy pliku; przy przekroczeniu zwracany błąd.
   - Brak automatycznej retencji: system NIE usuwa plików automatycznie. Przy przekroczeniu limitu użytkownik musi ręcznie usunąć istniejące CV, aby dodać nowe.

3. Ekstrakcja
   - Automatyczna ekstrakcja treści CV przy użyciu AI, z założeniem, że PDF zawiera osadzony tekst.
   - Jeśli ekstrakcja nie powiedzie się lub dane są niewystarczające, proces generowania listu zwróci komunikat: "Brak danych: nie udało się wygenerować listu motywacyjnego".

4. Dodawanie ogłoszenia o pracę
   - Obsługa copy-paste pełnego opisu ogłoszenia (text) oraz prosty formularz z polami: nazwa stanowiska, opis, wymagane technologie.
   - Limit długości opisu: minimum 1 000 znaków, maksimum 10 000 znaków.

5. Generowanie listu motywacyjnego
   - Generowanie listu na podstawie danych z CV i opisu ogłoszenia przy użyciu integracji z AI.
   - Model samodzielnie wybiera ton i szablon (bez ręcznego wyboru w MVP).
   - Kontrola kosztów AI nie jest częścią MVP; system polega na limitach po stronie providera AI.
   - Wygenerowany list dostępny do edycji w prostym edytorze tekstowym oraz z podglądem PDF.
   - Użytkownik może wygenerować maksymalnie 5 listów motywacyjnych - brak automatycznej retencji.

6. Edycja i pobieranie
   - Możliwość ręcznej edycji wygenerowanego listu w prostym edytorze; zapis zmian (brak wersjonowania i undo/redo).
   - Możliwość pobrania gotowego listu w formacie PDF (tylko PDF, bez innych formatów).

7. Zarządzanie danymi i logowanie
   - System NIE wykonuje automatycznej retencji. Zamiast tego stosujemy sztywne limity zasobów: maksymalnie 5 CV oraz maksymalnie 5 wygenerowanych listów na użytkownika. Przy próbie dodania kolejnego elementu użytkownik musi manualnie usunąć istniejące zasoby.
   - Zdarzenia systemowe logowane do pliku logów serwera (min. pola: timestamp, userId, eventType, metadata).

8. Ograniczenia techniczne
   - Język wejściowy i wyjściowy: wyłącznie angielski.
   - Brak importu ogłoszeń z URL, brak integracji z platformami zewnętrznymi, brak funkcji społecznościowych.

## 4. Granice produktu

- W zakres MVP NIE wchodzą: obsługa formatów CV innych niż PDF, pobieranie listów w formatach innych niż PDF, import ogłoszeń z URL, funkcje społecznościowe, integracje z platformami rekrutacyjnymi ani zaawansowane zarządzanie kosztami AI.
- Brak wersjonowania listów i brak zaawansowanej analityki w MVP.

## 5. Historyjki użytkowników

- ID: US-001
  Tytuł: Rejestracja nowego użytkownika
  Opis: Jako nowy użytkownik chcę się zarejestrować przy użyciu email i hasła, aby mieć konto przechowujące moje CV i wygenerowane listy.
  Kryteria akceptacji:
  - Formularz rejestracji przyjmuje email i hasło.
  - Po rejestracji tworzone jest konto z unikalnym userId.
  - Hasło przechowywane jest w bezpieczny sposób (hash).
  - Użytkownik otrzymuje potwierdzenie rejestracji i może się zalogować.

- ID: US-002
  Tytuł: Logowanie istniejącego użytkownika
  Opis: Jako zarejestrowany użytkownik chcę się zalogować przez email i hasło, aby uzyskać dostęp do mojego profilu i zasobów.
  Kryteria akceptacji:
  - Możliwość logowania przy użyciu poprawnych danych.
  - Niepoprawne dane zwracają komunikat błędu.
  - Po zalogowaniu użytkownik trafia do strony profilu z listą CV i listów.

- ID: US-003
  Tytuł: Upload CV w formacie PDF
  Opis: Jako użytkownik chcę załadować moje CV w formacie PDF (maks. kilka MB), aby system mógł je wykorzystać do generowania listów.
  Kryteria akceptacji:
  - System akceptuje tylko pliki z rozszerzeniem .pdf.
  - Plik nie przekracza kilku MB; większe pliki są odrzucane z komunikatem.
  - Duplikat treści (porównanie hash) jest wykrywany i upload jest odrzucany.
  - Maksymalnie 5 CV na konto; przekroczenie limitu blokuje upload z komunikatem.
  - Nazwy plików są numerowane jako cv1..cvN; istnieją limity długości nazwy.

- ID: US-004
  Tytuł: Automatyczna ekstrakcja treści CV
  Opis: Jako system chcę automatycznie wyodrębnić tekst z załadowanego CV, plik powinnien zawierać tylko tekst nie procesujemy skanów PDF.
  Kryteria akceptacji:
  - Po uploadzie uruchamiana jest ekstrakcja treści.
  - Wynik ekstrakcji jest zapisany i widoczny w metadanych CV.
  - Jeśli ekstrakcja zawiedzie, generowanie listu zwraca komunikat "Brak danych: nie udało się wygenerować listu motywacyjnego".
  - Jeśli plik pdf nie jest tekstem tylko skanem zwracamy błąd.

- ID: US-005
  Tytuł: Dodanie opisu ogłoszenia o pracę (copy-paste lub formularz)
  Opis: Jako użytkownik chcę wkleić opis ogłoszenia lub wypełnić prosty formularz, aby system miał kontekst do wygenerowania listu.
  Kryteria akceptacji:
  - System przyjmuje pełny opis jako text lub poprzez pola: stanowisko, opis, technologie.
  - Długość opisu mieści się w przedziale 1000–10000 znaków; poza tym zwracany jest błąd walidacji.

- ID: US-006
  Tytuł: Generowanie listu motywacyjnego przez AI
  Opis: Jako użytkownik chcę wygenerować list motywacyjny na podstawie mojego CV i opisu ogłoszenia, aby otrzymać gotowy dokument do aplikacji.
  Kryteria akceptacji:
  - System uruchamia pipeline: ekstrakcja → prompt do modelu AI → wygenerowany tekst listu.
  - Jeśli ekstrakcja jest niewystarczająca, użytkownik otrzymuje komunikat "Brak danych..." i proces przerywa się opisanym komunikatem.
  - Wygenerowany list jest zapisywany i dostępny do edycji oraz pobrania.

- ID: US-007
  Tytuł: Edycja wygenerowanego listu
  Opis: Jako użytkownik chcę edytować wygenerowany list w prostym edytorze i zapisać zmiany.
  Kryteria akceptacji:
  - Edytor umożliwia modyfikację tekstu i zapis.
  - Zmiany są zapisywane i wpływają na plik PDF generowany przy pobieraniu.
  - Brak wersjonowania; kolejne zapisy nadpisują poprzednią treść.

- ID: US-008
  Tytuł: Pobranie listu motywacyjnego w PDF
  Opis: Jako użytkownik chcę pobrać ostateczny list w formacie PDF.
  Kryteria akceptacji:
  - System generuje PDF bez watermarków.
  - Plik PDF odzwierciedla aktualny stan tekstu zapisanego w edytorze.

- ID: US-009
  Tytuł: Przegląd profilu użytkownika
  Opis: Jako użytkownik chcę przeglądać moje przesłane CV i wygenerowane listy na stronie profilu.
  Kryteria akceptacji:
  - Profil pokazuje listę CV (z datą uploadu i metadanymi) i listów (z datą wygenerowania).
  - Możliwość usunięcia CV i listu ręcznie przed upływem 30 dni (jeśli zaimplementowane).  

- ID: US-010
  Tytuł: Logowanie zdarzeń do pliku
  Opis: Jako zespół techniczny chcemy zapisywać zdarzenia systemowe do pliku logów w celu zliczania KPI.
  Kryteria akceptacji:
  - Logi zawierają minimalne pola: timestamp, userId, eventType, metadata.
  - Logi rejestrują zdarzenia: CV_uploaded, Letter_generated, OCR_performed, Extraction_failed, Duplicate_upload_attempt, File_deleted.

- ID: US-011
  Tytuł: Obsługa limitu i duplikatów CV
  Opis: Jako użytkownik chcę być informowany, gdy próbuję przesłać zduplikowane CV lub przekraczam limit 5 CV.
  Kryteria akceptacji:
  - Przy próbie uploadu duplikatu użytkownik dostaje jasny komunikat o duplikacie i instrukcję (usuń istniejące lub zmień nazwę).
  - Przy próbie przekroczenia limitu 5 CV użytkownik otrzymuje komunikat i upload jest odrzucony.

- ID: US-012
  Tytuł: Obsługa błędów ekstrakcji i UX komunikatu
  Opis: Jako użytkownik chcę otrzymać czytelny komunikat gdy ekstrakcja CV nie powiedzie się oraz propozycję następnego kroku.
  Kryteria akceptacji:
  - Jeśli ekstrakcja nie powiedzie się, system pokazuje komunikat "Brak danych: nie udało się wygenerować listu motywacyjnego" oraz wskazówkę: "Spróbuj przesłać inne CV lub poprawić skan".

- ID: US-013
  Tytuł: Bezpieczne uwierzytelnianie
  Opis: Jako użytkownik chcę bezpiecznie się uwierzytelnić, aby moje CV i listy były dostępne tylko dla mnie.
  Kryteria akceptacji:
  - Hasła są hashowane przed zapisem.
  - Sesje chronione mechanizmem sesji/tokenów.
  - Nieautoryzowany dostęp jest odrzucany (403/401).

- ID: US-014
  Tytuł: Edge case - upload uszkodzonego/nieczytelnego PDF
  Opis: Jako użytkownik chcę otrzymać jasny komunikat, gdy przesłany PDF jest uszkodzony lub nieczytelny.
  Kryteria akceptacji:
  - System wykrywa uszkodzony plik i odrzuca upload z komunikatem.

## 6. Metryki sukcesu

- KPI główny:
  - 90% użytkowników posiada przynajmniej jedno CV i wygenerowany co najmniej jeden list motywacyjny (okno pomiarowe: do potwierdzenia, rekomendowane 30 dni od rejestracji).

- Metryki techniczne i health:
  - Liczba uploadów CV (total, per-user average).
  - Liczba wygenerowanych listów (total, per-user average).
  - Liczba sukcesów ekstrakcji vs. liczba Extraction_failed.
  - Liczba prób uploadu duplikatów.
  - Liczba błędów pipeline'u AI i czas odpowiedzi modelu.

- Logi i pomiar:
  - Pomiar KPI w MVP realizowany przez parsowanie pliku logów serwera i policzenie unikalnych userId z eventami CV_uploaded i Letter_generated.
