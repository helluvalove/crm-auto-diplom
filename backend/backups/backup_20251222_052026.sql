--
-- PostgreSQL database dump
--

\restrict ljrhbWaf6zl7Zz4Mj9ZKR3MaAK2cLL1fPFlLz6sJ3dhCe857NpWGQ3r8xpO123A

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

-- Started on 2025-12-22 05:20:26

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 228 (class 1259 OID 24658)
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointments (
    appointment_id integer NOT NULL,
    client_id integer,
    client_name character varying(100),
    client_phone character varying(20),
    car_info text,
    status character varying(50) DEFAULT 'Новая'::character varying,
    requested_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT appointments_status_check CHECK (((status)::text = ANY ((ARRAY['Новая'::character varying, 'Подтверждена'::character varying, 'Отменена'::character varying])::text[])))
);


ALTER TABLE public.appointments OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 24657)
-- Name: appointments_appointment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.appointments_appointment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.appointments_appointment_id_seq OWNER TO postgres;

--
-- TOC entry 5039 (class 0 OID 0)
-- Dependencies: 227
-- Name: appointments_appointment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.appointments_appointment_id_seq OWNED BY public.appointments.appointment_id;


--
-- TOC entry 222 (class 1259 OID 24600)
-- Name: cars; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cars (
    car_id integer NOT NULL,
    client_id integer NOT NULL,
    vin character varying(17),
    gos_number character varying(9),
    model character varying(100),
    mileage integer,
    year integer
);


ALTER TABLE public.cars OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 24599)
-- Name: cars_car_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cars_car_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cars_car_id_seq OWNER TO postgres;

--
-- TOC entry 5040 (class 0 OID 0)
-- Dependencies: 221
-- Name: cars_car_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cars_car_id_seq OWNED BY public.cars.car_id;


--
-- TOC entry 220 (class 1259 OID 24591)
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    client_id integer NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    telegram_chat_id bigint
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 24590)
-- Name: clients_client_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clients_client_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clients_client_id_seq OWNER TO postgres;

--
-- TOC entry 5041 (class 0 OID 0)
-- Dependencies: 219
-- Name: clients_client_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clients_client_id_seq OWNED BY public.clients.client_id;


--
-- TOC entry 226 (class 1259 OID 24644)
-- Name: order_photos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_photos (
    photo_id integer NOT NULL,
    order_id integer NOT NULL,
    file_url text NOT NULL,
    comment text
);


ALTER TABLE public.order_photos OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 24643)
-- Name: order_photos_photo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_photos_photo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_photos_photo_id_seq OWNER TO postgres;

--
-- TOC entry 5042 (class 0 OID 0)
-- Dependencies: 225
-- Name: order_photos_photo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_photos_photo_id_seq OWNED BY public.order_photos.photo_id;


--
-- TOC entry 218 (class 1259 OID 24579)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    login character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(100) NOT NULL,
    phone character varying(20),
    role character varying(20) NOT NULL,
    specialization character varying(100),
    tabel_number character varying(50),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['manager'::character varying, 'mechanic'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 24578)
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_user_id_seq OWNER TO postgres;

--
-- TOC entry 5043 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- TOC entry 224 (class 1259 OID 24612)
-- Name: work_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_orders (
    order_id integer NOT NULL,
    client_id integer NOT NULL,
    car_id integer NOT NULL,
    manager_id integer,
    mechanic_id integer,
    status character varying(50) DEFAULT 'Создан'::character varying NOT NULL,
    problem_description text,
    work_description text,
    total_price numeric(10,2),
    created_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_date timestamp without time zone,
    CONSTRAINT work_orders_status_check CHECK (((status)::text = ANY ((ARRAY['Создан'::character varying, 'На диагностике'::character varying, 'В работе'::character varying, 'Готов к выдаче'::character varying, 'Выполнен'::character varying, 'Отменен'::character varying])::text[])))
);


ALTER TABLE public.work_orders OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 24611)
-- Name: work_orders_order_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_orders_order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_orders_order_id_seq OWNER TO postgres;

--
-- TOC entry 5044 (class 0 OID 0)
-- Dependencies: 223
-- Name: work_orders_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_orders_order_id_seq OWNED BY public.work_orders.order_id;


--
-- TOC entry 4843 (class 2604 OID 24661)
-- Name: appointments appointment_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments ALTER COLUMN appointment_id SET DEFAULT nextval('public.appointments_appointment_id_seq'::regclass);


--
-- TOC entry 4838 (class 2604 OID 24603)
-- Name: cars car_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cars ALTER COLUMN car_id SET DEFAULT nextval('public.cars_car_id_seq'::regclass);


--
-- TOC entry 4837 (class 2604 OID 24594)
-- Name: clients client_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients ALTER COLUMN client_id SET DEFAULT nextval('public.clients_client_id_seq'::regclass);


--
-- TOC entry 4842 (class 2604 OID 24647)
-- Name: order_photos photo_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_photos ALTER COLUMN photo_id SET DEFAULT nextval('public.order_photos_photo_id_seq'::regclass);


--
-- TOC entry 4836 (class 2604 OID 24582)
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- TOC entry 4839 (class 2604 OID 24615)
-- Name: work_orders order_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders ALTER COLUMN order_id SET DEFAULT nextval('public.work_orders_order_id_seq'::regclass);


--
-- TOC entry 5033 (class 0 OID 24658)
-- Dependencies: 228
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.appointments (appointment_id, client_id, client_name, client_phone, car_info, status, requested_date, created_at) FROM stdin;
\.


--
-- TOC entry 5027 (class 0 OID 24600)
-- Dependencies: 222
-- Data for Name: cars; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cars (car_id, client_id, vin, gos_number, model, mileage, year) FROM stdin;
8	13	2C3CDXCT9FH734547	Р772КХ43	Niva Chevrolet	174354	2004
10	19	WMWRE334X3TD38226	Р876ОК43	Nissan Almera	234521	2009
11	20	1FMHK8F80BGA94363	С651ТО43	Daewoo Nexia N150	173000	2010
12	13	3VWDP7AJ7CM374911	О887ОО77	Niva Legend 4x4	21	2025
13	20	3VWDP7AJ8CM353775	В001ОР01	BMW X5M Competition	46070	2018
14	21	1J8GL48K06W183384	Р897ВМ05	Skoda Octavia A5	457800	2015
15	27	1GNCS18X35K171634	О987ТУ43	Lada Granta	49678	2021
17	31	3GNGK26K47G306189	А123ВВ143	Lada 2114	21000	1999
\.


--
-- TOC entry 5025 (class 0 OID 24591)
-- Dependencies: 220
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clients (client_id, name, phone, telegram_chat_id) FROM stdin;
13	Овчинников Максим Александрович	+79187060381	\N
19	Рубельтов Марк Афанасьевич	+78005553535	\N
20	Никулин Арсений Игоревич	+73242342342	\N
21	Тестов Тест Тестович	+71111111111	\N
27	Артемов Андрей Эдуардович	+78769432070	\N
31	Пери Утконос	+78005553567	\N
\.


--
-- TOC entry 5031 (class 0 OID 24644)
-- Dependencies: 226
-- Data for Name: order_photos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_photos (photo_id, order_id, file_url, comment) FROM stdin;
\.


--
-- TOC entry 5023 (class 0 OID 24579)
-- Dependencies: 218
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, login, password_hash, full_name, phone, role, specialization, tabel_number) FROM stdin;
1	admin	admin123	Администратор системы	\N	manager	\N	\N
3	anton123	scrypt:32768:8:1$cUvKdHkzPFpILNCC$48cfb00e25ece27c6e0c8394bf334d892812e2ad8f8ea5a077c1f1fdf3fe9d4596719c6f7be8f78a2fbd2801a2565e1dec18de42fc3b2193c600f75b2c6533e5	Антон Гантеля	+79096782987	mechanic	Кузовщик	003
2	mechanic	mechanic123	Петров Алексей Иванович	+79096782944	mechanic	Двигатели	123
4	mechanic007	scrypt:32768:8:1$yjSuOAu9vEWALCuO$8684eddd69a173b04314b38e5fab22d50a5db5162457347b0cd8b7c58925c8a6706220f8988f7986630d9779d9eaceffcba7f200b81f6fce8c6182455b86a1e1	Ян Топлес Крутой	+79096782343	mechanic	Кузов	007
6	test	scrypt:32768:8:1$t3I91fdWH6bsXyBd$75f86df303cbb9415ae1e2ea97fb8394cd9529e77d7cf3ecd42728ae5cce2875673a5af6e487e9d08c322ea035e472786471bcb2a83aef8a06b5fd653da230ee	Тестов Тест Тестович	+79096723432	mechanic	Моторист	029
5	sidorovsi	scrypt:32768:8:1$Xce7BXMoWCNzkLz4$db817c388809eff99c7015c41b396fb4f8f76b522023f5d3830bde8f001a02ca2ddcd7748412c49b1681f035de50bd7fa9640dc8d3a839e4df4a1278db797948	Сидоров Сергей Иванович	+79093242342	mechanic	Моторист	014
\.


--
-- TOC entry 5029 (class 0 OID 24612)
-- Dependencies: 224
-- Data for Name: work_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_orders (order_id, client_id, car_id, manager_id, mechanic_id, status, problem_description, work_description, total_price, created_date, completed_date) FROM stdin;
9	19	10	\N	2	В работе	Замена катушек зажигания	\N	9700.00	2025-12-18 07:52:46.185176	\N
10	20	11	\N	4	В работе	капитальная замена двигателя и всего остального	\N	0.12	2025-12-18 07:55:49.927526	\N
11	21	14	\N	4	На диагностике	Замена задней крышки багажника + палировка	\N	24150.00	2025-12-18 07:58:11.300361	\N
12	27	15	\N	3	Создан	замена лобового стекла	\N	24500.00	2025-12-18 08:22:41.42055	\N
7	13	8	\N	3	Выполнен	Замена реактивной тяги + крепления	+ замена подшипника левой стойки	6780.00	2025-12-18 07:39:08.234226	2025-12-20 15:13:50.912919
8	20	11	\N	4	Выполнен	Замена масла и прокладок головки	\N	124000.00	2025-12-18 07:41:52.825839	2025-12-20 15:19:37.339716
14	31	17	\N	4	В работе	замена ступицы	\N	5555.00	2025-12-20 16:30:15.503408	\N
\.


--
-- TOC entry 5045 (class 0 OID 0)
-- Dependencies: 227
-- Name: appointments_appointment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.appointments_appointment_id_seq', 1, false);


--
-- TOC entry 5046 (class 0 OID 0)
-- Dependencies: 221
-- Name: cars_car_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cars_car_id_seq', 17, true);


--
-- TOC entry 5047 (class 0 OID 0)
-- Dependencies: 219
-- Name: clients_client_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.clients_client_id_seq', 31, true);


--
-- TOC entry 5048 (class 0 OID 0)
-- Dependencies: 225
-- Name: order_photos_photo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_photos_photo_id_seq', 1, false);


--
-- TOC entry 5049 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 6, true);


--
-- TOC entry 5050 (class 0 OID 0)
-- Dependencies: 223
-- Name: work_orders_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_orders_order_id_seq', 14, true);


--
-- TOC entry 4868 (class 2606 OID 24668)
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (appointment_id);


--
-- TOC entry 4859 (class 2606 OID 24605)
-- Name: cars cars_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_pkey PRIMARY KEY (car_id);


--
-- TOC entry 4854 (class 2606 OID 24598)
-- Name: clients clients_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_phone_key UNIQUE (phone);


--
-- TOC entry 4856 (class 2606 OID 24596)
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (client_id);


--
-- TOC entry 4866 (class 2606 OID 24651)
-- Name: order_photos order_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_photos
    ADD CONSTRAINT order_photos_pkey PRIMARY KEY (photo_id);


--
-- TOC entry 4850 (class 2606 OID 24589)
-- Name: users users_login_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_login_key UNIQUE (login);


--
-- TOC entry 4852 (class 2606 OID 24587)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 4864 (class 2606 OID 24622)
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (order_id);


--
-- TOC entry 4869 (class 1259 OID 24678)
-- Name: idx_appointments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_status ON public.appointments USING btree (status);


--
-- TOC entry 4860 (class 1259 OID 24677)
-- Name: idx_cars_vin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cars_vin ON public.cars USING btree (vin);


--
-- TOC entry 4857 (class 1259 OID 24676)
-- Name: idx_clients_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_phone ON public.clients USING btree (phone);


--
-- TOC entry 4861 (class 1259 OID 24675)
-- Name: idx_work_orders_mechanic; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_mechanic ON public.work_orders USING btree (mechanic_id);


--
-- TOC entry 4862 (class 1259 OID 24674)
-- Name: idx_work_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_status ON public.work_orders USING btree (status);


--
-- TOC entry 4876 (class 2606 OID 24669)
-- Name: appointments appointments_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id) ON DELETE SET NULL;


--
-- TOC entry 4870 (class 2606 OID 24606)
-- Name: cars cars_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id) ON DELETE CASCADE;


--
-- TOC entry 4875 (class 2606 OID 24652)
-- Name: order_photos order_photos_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_photos
    ADD CONSTRAINT order_photos_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.work_orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4871 (class 2606 OID 24628)
-- Name: work_orders work_orders_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(car_id) ON DELETE CASCADE;


--
-- TOC entry 4872 (class 2606 OID 24623)
-- Name: work_orders work_orders_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id) ON DELETE CASCADE;


--
-- TOC entry 4873 (class 2606 OID 24633)
-- Name: work_orders work_orders_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- TOC entry 4874 (class 2606 OID 24638)
-- Name: work_orders work_orders_mechanic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_mechanic_id_fkey FOREIGN KEY (mechanic_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


-- Completed on 2025-12-22 05:20:28

--
-- PostgreSQL database dump complete
--

\unrestrict ljrhbWaf6zl7Zz4Mj9ZKR3MaAK2cLL1fPFlLz6sJ3dhCe857NpWGQ3r8xpO123A

