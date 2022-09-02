use crate::lifecycle::{init_logger, init_state, UPGRADE_BUFFER_SIZE};
use crate::{Data, LOG_MESSAGES};
use candid::Principal;
use canister_logger::{LogMessage, LogMessagesWrapper};
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::deserialize_from_stable_memory;
use std::collections::HashMap;
use tracing::info;
use types::{ChatId, TimestampMillis};
use user_canister::post_upgrade::Args;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new());

    let (mut data, log_messages, trace_messages): (Data, Vec<LogMessage>, Vec<LogMessage>) =
        deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap();

    let deleted_groups = deleted_groups();
    let to_remove: Vec<_> = data
        .group_chats
        .iter()
        .filter_map(|g| deleted_groups.get(&g.chat_id).map(|ts| (g.chat_id, *ts)))
        .collect();

    for (chat_id, timestamp) in to_remove {
        data.group_chats.remove(chat_id, timestamp);
    }

    init_logger(data.test_mode);
    init_state(env, data, args.wasm_version);

    if !log_messages.is_empty() || !trace_messages.is_empty() {
        LOG_MESSAGES.with(|l| rehydrate_log_messages(log_messages, trace_messages, &l.borrow()))
    }

    info!(version = %args.wasm_version, "Post-upgrade complete");
}

fn rehydrate_log_messages(
    log_messages: Vec<LogMessage>,
    trace_messages: Vec<LogMessage>,
    messages_container: &LogMessagesWrapper,
) {
    for message in log_messages {
        messages_container.logs.push(message);
    }

    for message in trace_messages {
        messages_container.traces.push(message);
    }
}

fn deleted_groups() -> HashMap<ChatId, TimestampMillis> {
    [
        ("7amso-uaaaa-aaaaf-ae4qa-cai", 1649242686874),
        ("uwzof-aaaaa-aaaaf-acy6a-cai", 1645508724547),
        ("onjym-cqaaa-aaaaf-aaeua-cai", 1648223511155),
        ("ivg4l-nqaaa-aaaaf-agbqa-cai", 1650605401369),
        ("uv2xk-zyaaa-aaaaf-adfdq-cai", 1646005286024),
        ("o52hr-iyaaa-aaaaf-ahd7a-cai", 1653838188122),
        ("ima4i-xqaaa-aaaaf-abz7a-cai", 1644951184299),
        ("2wflx-wqaaa-aaaaf-abfyq-cai", 1642426571130),
        ("pnazh-iyaaa-aaaaf-aeheq-cai", 1647785757867),
        ("2ncd5-liaaa-aaaaf-aaa7a-cai", 1642234203505),
        ("2nqss-naaaa-aaaaf-aeeua-cai", 1647647674377),
        ("xs4x5-qyaaa-aaaaf-alkda-cai", 1657157667600),
        ("y72zf-tqaaa-aaaaf-afkoq-cai", 1650064029245),
        ("sltmb-laaaa-aaaaf-aakya-cai", 1642197611681),
        ("v3dfp-vyaaa-aaaaf-apfva-cai", 1661870260178),
        ("shdv4-7iaaa-aaaaf-aec6a-cai", 1647645641857),
        ("q42qx-wyaaa-aaaaf-aanla-cai", 1642209885310),
        ("jg367-uaaaa-aaaaf-aadyq-cai", 1655205484436),
        ("7pjg6-7qaaa-aaaaf-abwoa-cai", 1647932877989),
        ("bozuy-ayaaa-aaaaf-adzua-cai", 1647355076572),
        ("itd23-zaaaa-aaaaf-ae7oa-cai", 1649471546978),
        ("qxz6r-jaaaa-aaaaf-aabgq-cai", 1638287333147),
        ("bbziw-fiaaa-aaaaf-aezaa-cai", 1651011695660),
        ("i6bxa-saaaa-aaaaf-acwta-cai", 1645153164949),
        ("mwdb3-daaaa-aaaaf-ag6oq-cai", 1653125313777),
        ("iuc4p-uyaaa-aaaaf-ae7oq-cai", 1657593455125),
        ("sqcqj-qyaaa-aaaaf-abq2a-cai", 1648960251582),
        ("x374b-gqaaa-aaaaf-alkcq-cai", 1657156962543),
        ("3r4e3-6aaaa-aaaaf-agwca-cai", 1652218085878),
        ("wcb2t-ciaaa-aaaaf-ahg3q-cai", 1654772066322),
        ("qnp3b-cyaaa-aaaaf-aer3q-cai", 1652586951068),
        ("2dbdg-6qaaa-aaaaf-agr2q-cai", 1651767659556),
        ("qxlp6-piaaa-aaaaf-aefnq-cai", 1647723253259),
        ("pqcx5-bqaaa-aaaaf-ah45a-cai", 1655306659891),
        ("7l7zi-kqaaa-aaaaf-abrtq-cai", 1659710856026),
        ("iqegz-aqaaa-aaaaf-abz5a-cai", 1649121893346),
        ("wfa4h-pqaaa-aaaaf-ahg3a-cai", 1654772190200),
        ("kcmzb-zaaaa-aaaaf-abscq-cai", 1659710893531),
        ("swufm-xyaaa-aaaaf-an4hq-cai", 1659945839215),
        ("pbqa2-4qaaa-aaaaf-aapcq-cai", 1642217418653),
        ("rmw2d-qyaaa-aaaaf-adwva-cai", 1649043240364),
        ("mvtei-syaaa-aaaaf-afw4q-cai", 1650219844597),
        ("rwbsa-viaaa-aaaaf-abxmq-cai", 1643901843460),
        ("r7cz4-daaaa-aaaaf-abxna-cai", 1643902132059),
        ("mqqtj-rqaaa-aaaaf-ae7va-cai", 1650387057334),
        ("t47ns-oqaaa-aaaaf-afaca-cai", 1649798627755),
        ("7b57u-caaaa-aaaaf-abjkq-cai", 1642677320238),
        ("prsxu-zyaaa-aaaaf-aeyda-cai", 1650208925628),
        ("yf2ix-6iaaa-aaaaf-abfwa-cai", 1643875462217),
        ("vlxjk-naaaa-aaaaf-ahk5a-cai", 1654950452532),
        ("kw7ni-aiaaa-aaaaf-agnrq-cai", 1651321799691),
        ("l4hwd-kqaaa-aaaaf-aadxq-cai", 1642184676673),
        ("geio6-gaaaa-aaaaf-acpja-cai", 1646536799304),
        ("opiqf-fiaaa-aaaaf-agz4q-cai", 1652299534713),
        ("h6ch3-iyaaa-aaaaf-afxaq-cai", 1650221883897),
        ("6bq3s-iaaaa-aaaaf-abruq-cai", 1659712466628),
        ("24xil-7iaaa-aaaaf-ae4pq-cai", 1649242674771),
        ("vzr6t-bqaaa-aaaaf-ahk6a-cai", 1655004336655),
        ("c65hp-uqaaa-aaaaf-afx5a-cai", 1650249880983),
        ("acamo-6yaaa-aaaaf-adscq-cai", 1646824594650),
        ("aqg3x-siaaa-aaaaf-adsbq-cai", 1653025700742),
        ("ugma2-naaaa-aaaaf-aab6q-cai", 1647105034278),
        ("2ztd3-vaaaa-aaaaf-ag2ja-cai", 1652530335957),
        ("e7fer-vaaaa-aaaaf-al5qq-cai", 1658145558247),
        ("a6r3b-gqaaa-aaaaf-aezeq-cai", 1652676659090),
        ("b47db-miaaa-aaaaf-adzxa-cai", 1648282250149),
        ("ohp35-kiaaa-aaaaf-aehdq-cai", 1647785779692),
        ("353ex-caaaa-aaaaf-aeqfa-cai", 1648244407865),
        ("p2tn5-baaaa-aaaaf-afrlq-cai", 1650140921493),
        ("zhuqx-uqaaa-aaaaf-agffq-cai", 1651965495668),
        ("22rxh-cqaaa-aaaaf-abwqa-cai", 1648934008269),
        ("twks7-oiaaa-aaaaf-adw2a-cai", 1647078803383),
        ("fs4wh-jqaaa-aaaaf-abu2a-cai", 1643958774964),
        ("juov2-qqaaa-aaaaf-acwua-cai", 1645179570678),
        ("4h4js-aqaaa-aaaaf-aalza-cai", 1661345569987),
        ("tyi7x-vyaaa-aaaaf-adw3a-cai", 1647061549076),
        ("fwi56-3qaaa-aaaaf-aawcq-cai", 1642240797753),
        ("f5jhx-diaaa-aaaaf-ab7ka-cai", 1644569041256),
        ("5dbda-yyaaa-aaaaf-afkra-cai", 1650065502547),
        ("jcnbj-baaaa-aaaaf-aaefa-cai", 1642177343933),
        ("qo6tb-5iaaa-aaaaf-abina-cai", 1642678523404),
        ("2kdfj-gqaaa-aaaaf-aaa7q-cai", 1637700445864),
        ("ftmzh-kiaaa-aaaaf-aoxia-cai", 1661296461786),
        ("5cbgj-byaaa-aaaaf-adpba-cai", 1646563638178),
        ("qljen-7aaaa-aaaaf-ab3ea-cai", 1648933966807),
        ("l2rmp-waaaa-aaaaf-aaiga-cai", 1642184117840),
        ("65fjq-qaaaa-aaaaf-acb4a-cai", 1649830472348),
        ("uxzlm-zaaaa-aaaaf-ae5oa-cai", 1649250823040),
        ("q62vn-7iaaa-aaaaf-aabha-cai", 1638308643975),
        ("kyin6-uqaaa-aaaaf-abguq-cai", 1649044808850),
        ("kvyrk-zyaaa-aaaaf-adlcq-cai", 1646285133494),
        ("r7s44-ciaaa-aaaaf-aewda-cai", 1648604470685),
        ("oh5ks-maaaa-aaaaf-aadiq-cai", 1642295697346),
        ("6gr5g-fyaaa-aaaaf-abrua-cai", 1659710877028),
        ("qjmjj-yqaaa-aaaaf-ad5ca-cai", 1648007665004),
        ("lcdgb-pqaaa-aaaaf-amivq-cai", 1658854989669),
        ("nkjgq-xiaaa-aaaaf-absta-cai", 1659711643989),
        ("glmx5-dyaaa-aaaaf-abutq-cai", 1659712436183),
        ("ba745-3aaaa-aaaaf-ahc3q-cai", 1653639840696),
        ("ko6ut-kiaaa-aaaaf-ae7bq-cai", 1649471557023),
        ("t74u5-xiaaa-aaaaf-ae57q-cai", 1649294959896),
        ("e4rep-eqaaa-aaaaf-amoma-cai", 1659165860613),
        ("p3aui-qaaaa-aaaaf-abbua-cai", 1642356855069),
        ("zstb2-vyaaa-aaaaf-agfga-cai", 1652429309403),
        ("qhjyq-kaaaa-aaaaf-aasma-cai", 1642227006250),
        ("bjysm-naaaa-aaaaf-adzuq-cai", 1651039520233),
        ("evgax-iiaaa-aaaaf-abtba-cai", 1659712452022),
        ("purav-2qaaa-aaaaf-afrkq-cai", 1650140110436),
        ("bf7sa-raaaa-aaaaf-ab7tq-cai", 1644774239491),
        ("hjqr3-uyaaa-aaaaf-aoxha-cai", 1661294035812),
        ("stfml-jiaaa-aaaaf-aewja-cai", 1648604460557),
        ("hgctt-mqaaa-aaaaf-abuua-cai", 1659710920177),
        ("a6sc5-pyaaa-aaaaf-adnfa-cai", 1646327617023),
        ("nm4fa-cqaaa-aaaaf-agnda-cai", 1651321615212),
        ("p5slj-myaaa-aaaaf-afrla-cai", 1650140818164),
        ("fg7ho-rqaaa-aaaaf-adkha-cai", 1646018632374),
        ("neodg-cyaaa-aaaaf-adyya-cai", 1647857369266),
        ("yy724-6aaaa-aaaaf-abraq-cai", 1643210430571),
        ("tcibm-dqaaa-aaaaf-al6pq-cai", 1658685849967),
        ("perdu-yyaaa-aaaaf-aadoa-cai", 1643471568490),
        ("qonp5-viaaa-aaaaf-ad5cq-cai", 1647562039760),
        ("rab7p-nqaaa-aaaaf-aer4a-cai", 1648934027435),
        ("afbk2-taaaa-aaaaf-adsca-cai", 1653025674879),
        ("ndpfs-paaaa-aaaaf-adyyq-cai", 1649472841135),
        ("3tjm7-yyaaa-aaaaf-abrka-cai", 1643240793473),
        ("ufkrl-2yaaa-aaaaf-adwja-cai", 1647007309521),
        ("cg3cf-xqaaa-aaaaf-aekca-cai", 1649936709019),
        ("faobt-eaaaa-aaaaf-aaozq-cai", 1644354697210),
        ("jbjex-ryaaa-aaaaf-acwxq-cai", 1648487947708),
        ("nnni2-uqaaa-aaaaf-adyzq-cai", 1647334697714),
        ("oipht-pyaaa-aaaaf-adhxq-cai", 1646577304025),
        ("c6o3t-4qaaa-aaaaf-ahcsq-cai", 1653413971244),
        ("vbgtk-nqaaa-aaaaf-afhlq-cai", 1650060568721),
        ("7mo24-gaaaa-aaaaf-aeq5a-cai", 1651251243331),
        ("xz7z3-paaaa-aaaaf-algoq-cai", 1661517194546),
        ("d3qc5-paaaa-aaaaf-apvha-cai", 1662007233025),
        ("7x3dz-5qaaa-aaaaf-abrrq-cai", 1643388325859),
        ("a6v6m-gyaaa-aaaaf-aacka-cai", 1642175650617),
        ("epxzw-kqaaa-aaaaf-agmta-cai", 1651295113674),
        ("jbije-7qaaa-aaaaf-aehta-cai", 1648567286846),
        ("umj2x-mqaaa-aaaaf-adwiq-cai", 1660015318840),
        ("nbi4z-pqaaa-aaaaf-aa33q-cai", 1649541665781),
        ("psbl3-biaaa-aaaaf-aaeqq-cai", 1646838281422),
        ("eahay-oiaaa-aaaaf-aenja-cai", 1648135761067),
        ("e2s4u-myaaa-aaaaf-ahjvq-cai", 1654948465157),
        ("tjy47-pyaaa-aaaaf-afabq-cai", 1649943622105),
        ("mrchp-oyaaa-aaaaf-ag6oa-cai", 1653831323634),
        ("hbdvh-biaaa-aaaaf-abuuq-cai", 1659711703824),
        ("y5o4s-3aaaa-aaaaf-ae4ca-cai", 1649173480974),
        ("3uypl-uiaaa-aaaaf-aeqeq-cai", 1648231301789),
        ("nl62i-gaaaa-aaaaf-abzca-cai", 1643987816873),
        ("kmouj-cqaaa-aaaaf-absdq-cai", 1659711720370),
        ("axh5d-7qaaa-aaaaf-adsba-cai", 1653025653434),
        ("xgjsw-oyaaa-aaaaf-ajl3q-cai", 1660721324561),
        ("klps5-piaaa-aaaaf-absda-cai", 1659719417966),
        ("n4zo7-oyaaa-aaaaf-abvnq-cai", 1643562901233),
        ("tqyn6-sqaaa-aaaaf-ahgfa-cai", 1655539991937),
        ("mnbbp-qyaaa-aaaaf-afrda-cai", 1650115510044),
        ("envid-eaaaa-aaaaf-ahf2a-cai", 1654441595637),
        ("ukpf3-riaaa-aaaaf-ag4xa-cai", 1655388703312),
        ("4s2vm-pqaaa-aaaaf-ag26a-cai", 1652719854332),
        ("kmifl-fyaaa-aaaaf-aemia-cai", 1648111044051),
        ("on7mo-eqaaa-aaaaf-aa3rq-cai", 1642293295199),
        ("cr4z3-eyaaa-aaaaf-aibbq-cai", 1655316338813),
        ("xl3ve-7aaaa-aaaaf-ageeq-cai", 1650881406044),
        ("jgicd-4aaaa-aaaaf-acwxa-cai", 1645238318652),
        ("ywjxz-eqaaa-aaaaf-aalba-cai", 1642609186091),
        ("2daov-qyaaa-aaaaf-aaa6a-cai", 1640198154397),
        ("h4tks-oiaaa-aaaaf-aglga-cai", 1651720068161),
        ("izurz-6yaaa-aaaaf-admta-cai", 1646224980772),
        ("23wo7-sqaaa-aaaaf-ae4pa-cai", 1649255507842),
        ("ztb2v-raaaa-aaaaf-aidra-cai", 1655327321247),
        ("boi4l-pyaaa-aaaaf-aaj6q-cai", 1643388493152),
        ("u27d2-siaaa-aaaaf-agp5q-cai", 1653710637808),
        ("us4np-5aaaa-aaaaf-aakma-cai", 1643291868971),
        ("6geqy-kqaaa-aaaaf-ag2qa-cai", 1652587653389),
        ("krlgc-cyaaa-aaaaf-abgva-cai", 1642564144158),
        ("rhaz3-aiaaa-aaaaf-aer4q-cai", 1648473730305),
        ("gvih7-gyaaa-aaaaf-an7rq-cai", 1660003112826),
        ("kyo44-tyaaa-aaaaf-aey7a-cai", 1649053595997),
        ("pkb7t-faaaa-aaaaf-aehea-cai", 1647785768748),
        ("vawtd-vyaaa-aaaaf-agdvq-cai", 1650812090758),
        ("jg73s-uiaaa-aaaaf-aeywa-cai", 1650177235209),
        ("jk5ta-giaaa-aaaaf-aeu3a-cai", 1648587648197),
        ("sacti-sqaaa-aaaaf-aec6q-cai", 1647646036240),
        ("xpp65-naaaa-aaaaf-ahg4a-cai", 1654772158060),
        ("bp3f6-6yaaa-aaaaf-aezba-cai", 1648960177385),
        ("xf3md-dqaaa-aaaaf-ahbaq-cai", 1653705088277),
        ("qhlm7-naaaa-aaaaf-abxja-cai", 1643984677684),
        ("k7p2i-6aaaa-aaaaf-aey7q-cai", 1649629128562),
        ("seg5r-byaaa-aaaaf-aabia-cai", 1638372553111),
    ]
    .into_iter()
    .map(|(id, ts)| (ChatId::from(Principal::from_text(id).unwrap()), ts))
    .collect()
}
