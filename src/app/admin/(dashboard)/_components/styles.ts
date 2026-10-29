/**
 * Admin dashboard styles, shared by every admin page through the shell.
 * Moved unchanged from the single page dashboard; `d` is the active surface
 * variant (teal or charcoal) from src/lib/admin-theme.ts.
 */
import { ADMIN_CORAL, ADMIN_FONTS, ADMIN_INK } from '@/lib/admin-theme'
import type { Theme } from './theme'

export const adminCss = (d: Theme) => `
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden}
        body{font-family:${ADMIN_FONTS.body};font-weight:400;font-size:14px;background:${d.bg};color:${d.text}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{border-radius:2px}
        .admin-frame{display:flex;flex-direction:column;height:100vh}
        .shell{display:grid;grid-template-columns:80px 1fr;flex:1 1 auto;min-height:0;overflow:hidden}
        .main{display:grid;grid-template-columns:1fr 320px;height:100%;overflow:hidden;min-width:0}
        .center{overflow-y:auto;padding:28px 24px;min-width:0}
        .panel{border-left-width:1px;border-left-style:solid;overflow-y:auto}
        .panel-inner{padding:24px 20px}
        .sidebar{border-right-width:1px;border-right-style:solid;display:flex;flex-direction:column;align-items:center;padding:24px 0 20px}
        .sb-logo{width:42px;height:42px;background:${ADMIN_CORAL};border-radius:14px;display:flex;align-items:center;justify-content:center;font-family:${ADMIN_FONTS.display};font-style:italic;font-size:17px;color:${ADMIN_INK};flex-shrink:0}
        .sb-nav{display:flex;flex-direction:column;align-items:center;gap:0;flex:1;justify-content:space-evenly;width:100%;padding:16px 10px}
        .sb-btn{width:52px;height:52px;border-radius:14px;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:all 0.15s;padding:0}
        .sb-btn-label{font-size:12px;letter-spacing:0.04em;text-transform:uppercase;line-height:1}
        .sb-divider{width:32px;height:1px;margin:8px 0;flex-shrink:0}
        .sb-toggle{width:42px;height:42px;border-radius:50%;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;margin-top:8px}
        .page-header{margin-bottom:24px}
        .page-greeting{font-family:${ADMIN_FONTS.display};font-size:26px;font-weight:600;line-height:1.2;margin-bottom:4px}
        .page-greeting em{font-style:italic;color:${d.accent}}
        .page-sub{font-size:12px}
        .stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
        .stat-row-3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px}
        .stat-card{border-radius:16px;border-width:1px;border-style:solid;padding:16px 18px}
        .sc-label{font-size:12px;margin-bottom:6px}
        .sc-num{font-family:${ADMIN_FONTS.display};font-size:26px;font-weight:600;line-height:1}
        .sc-sub{font-size:12px;margin-top:3px}
        .section{margin-bottom:24px}
        .section-label{font-size:12px;font-weight:500;margin-bottom:12px;display:flex;align-items:center;gap:8px}
        .section-label-count{font-size:12px;padding:2px 8px;border-radius:10px}
        .booking-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
        .booking-card{border-radius:16px;padding:16px;cursor:pointer;transition:all 0.15s;border:2px solid transparent}
        .booking-card:hover{transform:translateY(-2px)}.booking-card.selected{border-color:${d.accent}}
        .bc-type{font-size:12px;margin-bottom:8px}.bc-name{font-family:${ADMIN_FONTS.display};font-size:15px;font-weight:600;margin-bottom:4px}
        .bc-date{font-size:12px;margin-bottom:10px}.bc-footer{display:flex;justify-content:space-between;align-items:center}
        .bc-countdown{font-family:${ADMIN_FONTS.display};font-style:italic;font-size:14px;color:${d.accent}}
        .bc-arrow{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px}
        .sub-list{display:flex;flex-direction:column;gap:6px}
        .sub-item{border-radius:12px;border-width:1px;border-style:solid;padding:12px 14px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:12px}
        .si-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
        .si-name{font-family:${ADMIN_FONTS.display};font-size:13px;font-weight:600;flex:1}
        .si-type{font-size:12px}.si-meta{font-size:12px;white-space:nowrap}
        .alert-row{border-radius:12px;border-width:1px;border-style:solid;padding:12px 14px;margin-bottom:6px;display:flex;align-items:center;gap:12px}
        .proj-row{border-radius:12px;border-width:1px;border-style:solid;padding:11px 14px;margin-bottom:6px;display:flex;align-items:center;gap:10px}
        .proj-name{font-family:${ADMIN_FONTS.display};font-size:13px;font-weight:600;flex:1}
        .proj-due{font-size:12px;white-space:nowrap}
        .cal-wrap{border-radius:16px;border-width:1px;border-style:solid;padding:16px;margin-bottom:12px}
        .cal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
        .cal-month-label{font-family:${ADMIN_FONTS.display};font-size:16px;font-weight:600}
        .cal-days-row{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px}
        .cal-day-label{font-size:12px;text-align:center;padding:4px 0}
        .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
        .cal-cell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:12px;cursor:pointer;transition:all 0.12s;position:relative}
        .cal-cell:hover{opacity:0.8}.cal-cell.empty{opacity:0;pointer-events:none}
        .slot-indicator{position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:${ADMIN_CORAL}}
        .care-diamond{display:inline-block;width:8px;height:8px;transform:rotate(45deg);background:#9BE3B6;border:1.5px solid #FBF3E8;flex:none}
        .care-diamond.in-cell{position:absolute;top:3px;right:3px}
        .care-cal-list{border:1px solid;border-radius:14px;padding:14px;margin:12px 0}
        .care-cal-item{display:flex;align-items:center;gap:10px;border:1px solid;border-radius:10px;padding:8px 10px;margin:0 0 6px;text-decoration:none;font-size:13px}
        .care-cal-item:hover{opacity:.9}.care-cal-item:focus-visible{outline:3px solid ${ADMIN_CORAL};outline-offset:2px}
        .care-cal-status{font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;white-space:nowrap}
        .day-block-panel{border-radius:12px;border-width:1px;border-style:solid;padding:14px;margin-bottom:16px}
        .dbp-title{font-size:12px;font-weight:500;margin-bottom:12px}
        .dbp-slots{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}
        .dbp-slot{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px}
        .dbp-slot-time{font-size:12px;flex:1}
        .dbp-slot-rm{background:none;border:none;font-size:14px;cursor:pointer;line-height:1;padding:0 2px}
        .dbp-add{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center}
        .dbp-input{font-family:${ADMIN_FONTS.body};font-size:12px;padding:7px 10px;border-radius:8px;outline:none;width:100%;border-width:1px;border-style:solid}
        .dbp-save{background:${ADMIN_CORAL};border:none;color:${ADMIN_INK};font-family:${ADMIN_FONTS.body};font-size:12px;font-weight:500;padding:7px 12px;border-radius:8px;cursor:pointer}
        .dbp-save:disabled{opacity:0.35;cursor:not-allowed}
        .day-cards{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:16px}
        .day-card{border-radius:10px;padding:8px 4px;border-width:1px;border-style:solid;cursor:pointer;text-align:center;transition:all 0.15s}
        .dc-name{font-size:12px;font-weight:500;margin-bottom:4px}.dc-dot{width:4px;height:4px;border-radius:50%;margin:0 auto 3px}.dc-time{font-size:8px}
        .hours-card{border-radius:14px;border-width:1px;border-style:solid;overflow:hidden;margin-bottom:16px}
        .hour-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom-width:1px;border-bottom-style:solid}
        .hour-item:last-child{border-bottom:none}.hi-day{font-size:12px;width:34px}
        .hi-toggle{position:relative;width:34px;height:20px;flex-shrink:0}
        .hi-toggle input{opacity:0;width:0;height:0;position:absolute}
        .hi-track{position:absolute;inset:0;border-radius:10px;cursor:pointer;transition:background 0.2s;border-width:1px;border-style:solid}
        .hi-thumb{position:absolute;top:2px;left:2px;width:14px;height:14px;background:white;border-radius:50%;transition:transform 0.2s;pointer-events:none}
        .hi-toggle input:checked~.hi-thumb{transform:translateX(14px)}
        .hi-times{display:flex;align-items:center;gap:6px;margin-left:auto}
        .hi-input{font-family:${ADMIN_FONTS.body};font-size:12px;padding:4px 8px;border-radius:8px;width:70px;outline:none;border-width:1px;border-style:solid}
        .hi-sep{font-size:12px}
        .blocked-card{border-radius:14px;border-width:1px;border-style:solid;padding:14px;margin-bottom:16px}
        .blocked-card-title{font-size:12px;font-weight:500;margin-bottom:10px}
        .bl-row{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;margin-bottom:4px}
        .bl-d{font-size:12px;flex:1}.bl-r{font-size:12px;flex:2}
        .bl-x{background:none;border:none;font-size:16px;cursor:pointer;line-height:1;padding:0 2px}
        .add-block-row{display:grid;grid-template-columns:120px 1fr auto;gap:6px;margin-top:10px}
        .ab-input{font-family:${ADMIN_FONTS.body};font-size:12px;padding:7px 10px;border-radius:8px;outline:none;width:100%;border-width:1px;border-style:solid}
        .ab-btn{background:${ADMIN_CORAL};border:none;color:${ADMIN_INK};font-family:${ADMIN_FONTS.body};font-size:12px;font-weight:500;padding:7px 14px;border-radius:8px;cursor:pointer}
        .ab-btn:disabled{opacity:0.35;cursor:not-allowed}
        .stage-section{margin-bottom:20px}
        .stage-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}
        .stage-pill{font-size:12px;font-weight:500;padding:3px 10px;border-radius:20px}
        .stage-count{font-size:12px;margin-left:auto}
        .client-row{border-radius:12px;border-width:1px;border-style:solid;padding:11px 14px;margin-bottom:4px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:all 0.15s}
        .cr-name{font-family:${ADMIN_FONTS.display};font-size:13px;font-weight:600;flex:1}.cr-meta{font-size:12px}
        .cr-btn{font-size:12px;font-weight:500;border:none;padding:4px 10px;border-radius:20px;cursor:pointer;white-space:nowrap}
        .rp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;text-align:center;padding:40px}
        .rp-empty-icon{font-size:40px;margin-bottom:8px}.rp-empty-text{font-size:12px;line-height:1.7}
        .rp-card{border-radius:16px;padding:18px;margin-bottom:16px}
        .rp-eyebrow{font-size:12px;font-weight:500;color:${d.accent};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px}
        .rp-name{font-family:${ADMIN_FONTS.display};font-size:20px;font-weight:600;margin-bottom:3px}
        .rp-meta{font-size:12px;margin-bottom:2px}
        .rp-time-badge{display:flex;align-items:center;gap:8px;border-radius:10px;padding:10px 12px;margin-top:10px}
        .rtb-cd{font-family:${ADMIN_FONTS.display};font-style:italic;font-size:14px;color:${d.accent};margin-left:auto}
        .rp-fields{margin-bottom:16px;display:flex;flex-direction:column;gap:12px}
        .rf-label{font-size:12px;font-weight:500;color:${d.accent};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px;opacity:0.8}
        .rf-val{font-size:13px;line-height:1.55}
        .rp-actions{display:flex;flex-direction:column;gap:8px}
        .ra-btn{display:flex;align-items:center;justify-content:center;padding:11px 16px;border-radius:12px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;text-decoration:none;border:none;width:100%}
        .ra-btn.fill{background:${ADMIN_CORAL};color:${ADMIN_INK}}.ra-btn.fill:hover{background:#FF8467}
        .empty-note{font-size:12px;text-align:center;padding:16px}
        .legend{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap}
        .legend-item{display:flex;align-items:center;gap:5px;font-size:12px}
        .legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .chart-wrap{border-radius:16px;border-width:1px;border-style:solid;padding:20px;margin-bottom:20px}
        .chart-title{font-family:${ADMIN_FONTS.display};font-size:15px;font-weight:600;margin-bottom:16px}
        .bar-chart{display:flex;align-items:flex-end;gap:8px;height:120px}
        .bar-col{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
        .bar{width:100%;border-radius:6px 6px 0 0;min-height:4px;cursor:pointer}.bar:hover{opacity:0.8}
        .bar-label{font-size:12px;white-space:nowrap}.bar-val{font-size:12px;white-space:nowrap}
        .data-table{border-radius:14px;border-width:1px;border-style:solid;overflow:hidden;margin-bottom:20px}
        .dt-header{display:grid;padding:10px 14px;border-bottom-width:1px;border-bottom-style:solid}
        .dt-row{display:grid;padding:11px 14px;border-bottom-width:1px;border-bottom-style:solid;align-items:center;transition:background 0.12s}
        .dt-row:last-child{border-bottom:none}.dt-row:hover{background:rgba(255,138,112,0.07)}
        .dt-cell{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .dt-cell.hd{font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.06em}
        .status-pill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:12px;font-weight:500}
        .add-row-btn{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:500;cursor:pointer;border:none;background:none}
        .form-card{border-radius:14px;border-width:1px;border-style:solid;padding:16px;margin-bottom:16px}
        .form-title{font-size:13px;font-weight:500;margin-bottom:14px}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
        .form-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px}
        .form-group{display:flex;flex-direction:column;gap:4px}
        .form-label{font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.06em}
        .form-actions{display:flex;gap:8px;justify-content:flex-end}
        .btn-save{background:${ADMIN_CORAL};border:none;color:${ADMIN_INK};font-family:${ADMIN_FONTS.body};font-size:12px;font-weight:500;padding:7px 16px;border-radius:8px;cursor:pointer}
        .btn-cancel{background:none;border-width:1px;border-style:solid;font-family:${ADMIN_FONTS.body};font-size:12px;font-weight:500;padding:7px 16px;border-radius:8px;cursor:pointer}
        .platform-bars{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
        .plat-card{border-radius:14px;border-width:1px;border-style:solid;padding:14px}
        .plat-label{font-size:12px;margin-bottom:6px}
        .plat-num{font-family:${ADMIN_FONTS.display};font-size:22px;font-weight:600;margin-bottom:8px}
        .plat-bar-bg{height:6px;border-radius:3px;overflow:hidden}
        .plat-bar-fill{height:100%;border-radius:3px;transition:width 0.4s}
        .icon-btn{background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;line-height:1}
        .doc-card{border-radius:14px;border-width:1px;border-style:solid;padding:16px;margin-bottom:10px}
        .doc-card-header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
        .doc-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .doc-name{font-family:${ADMIN_FONTS.display};font-size:14px;font-weight:600;flex:1}
        .doc-actions{display:flex;gap:8px}
        .doc-btn{flex:1;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;border:none;text-align:center;transition:all 0.15s}
        .doc-btn.fill{background:${ADMIN_CORAL};color:${ADMIN_INK}}.doc-btn.fill:hover{opacity:0.85}
        .upload-zone{border-radius:12px;border-width:2px;border-style:dashed;padding:20px;text-align:center;cursor:pointer;transition:all 0.15s;margin-bottom:16px;display:block}
        textarea.form-input{resize:vertical;min-height:70px;font-family:${ADMIN_FONTS.body};font-size:12px;padding:8px 10px;border-radius:8px;outline:none;width:100%;border-width:1px;border-style:solid;line-height:1.5}
        .fill-form-wrap{border-radius:14px;border-width:1px;border-style:solid;padding:20px;margin-bottom:20px}
        .fill-form-title{font-family:${ADMIN_FONTS.display};font-size:16px;font-weight:600;margin-bottom:4px}
        .fill-form-sub{font-size:12px;margin-bottom:20px}
        .section-divider{height:1px;margin:16px 0}
        .section-mini-label{font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px}
        .notes-box{border-radius:10px;border-width:1px;border-style:solid;padding:12px;font-size:12px;line-height:1.6;min-height:60px;cursor:pointer}
        .inv-row{display:flex;align-items:flex-start;flex-direction:column;gap:6px;padding:10px 12px;border-radius:10px;margin-bottom:6px}
        .preview-section{padding:12px 0;border-bottom-width:1px;border-bottom-style:solid}
        .preview-section:last-child{border-bottom:none}
        .preview-label{font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px}
        .preview-value{font-size:13px;line-height:1.6;white-space:pre-wrap}

        /* ---------- Admin identity: shared with the public site, dark ---------- */
        .shell{font-family:${ADMIN_FONTS.body};-webkit-font-smoothing:antialiased}
        .shell h1,.shell h2,.page-greeting,.sc-num,.bc-name,.si-name,.proj-name,.cal-month-label,.cr-name,.rp-name,.chart-title,.plat-num,.doc-name,.fill-form-title{font-variation-settings:'SOFT' 100;letter-spacing:-0.01em}
        .page-greeting{font-size:30px;font-weight:600}
        .page-greeting em{color:${d.accent}}
        .page-sub{font-size:13px}
        .admin-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${d.accent};margin-bottom:8px}
        .admin-eyebrow::before{content:'';width:18px;height:3px;border-radius:2px;background:${ADMIN_CORAL}}
        .sidebar{padding:18px 0 16px;width:100%}
        .sb-logo{width:46px;height:46px;border-radius:15px;background:${ADMIN_CORAL};color:${ADMIN_INK};border:2px solid ${d.text};box-shadow:3px 3px 0 ${d.text};font-style:normal;font-weight:700;font-size:17px}
        .tb-logo{width:38px;height:38px;border-radius:12px;background:${ADMIN_CORAL};color:${ADMIN_INK};border:2px solid ${d.text};display:flex;align-items:center;justify-content:center;font-family:${ADMIN_FONTS.display};font-weight:700;font-size:14px}
        .sb-admin{margin-top:10px;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:${d.accentBg};color:${d.accent}}
        .sb-btn{width:64px;height:58px;border-radius:16px;position:relative}
        .sb-btn:hover{background:${d.accentBg}!important}
        .sb-btn[aria-current=page]::before{content:'';position:absolute;left:-8px;top:14px;bottom:14px;width:3px;border-radius:2px;background:${ADMIN_CORAL}}
        .sb-btn-label{font-size:11px;font-weight:600;letter-spacing:0.06em}
        .sb-toggle{width:auto;min-width:64px;height:auto;border-radius:999px;padding:6px 8px;font-size:11px;font-weight:600;letter-spacing:0.04em;border:1px solid ${d.border2}!important;color:${d.text2}!important}
        .sb-toggle:hover{border-color:${d.accent}!important;color:${d.text}!important}
        .sb-toggle{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;white-space:nowrap;line-height:1.1}
        .sb-toggle-label{margin:0!important}
        .stat-card,.form-card,.fill-form-wrap,.doc-card,.chart-wrap,.data-table,.cal-wrap,.hours-card,.blocked-card,.day-block-panel,.plat-card{border-radius:18px}
        .booking-card{border-radius:18px;border:1.5px solid ${d.border}}
        .booking-card.selected,.booking-card:focus-visible{border-color:${d.accent}}
        .sub-item,.client-row,.proj-row,.alert-row{border-radius:14px}
        .sc-label,.sc-sub,.si-type,.si-meta,.cr-meta,.proj-due,.bc-type,.bc-date{font-size:12px}
        .sc-num{font-size:28px}
        .section-label{font-size:13px;font-weight:700;letter-spacing:0.02em}
        .section-label-count{font-size:12px;font-weight:600}
        .form-label,.section-mini-label,.preview-label,.dt-cell.hd,.rf-label{font-size:11px;font-weight:700;letter-spacing:0.08em}
        .rf-label{opacity:1}
        .rf-val,.preview-value{font-size:14px}
        .dt-cell{font-size:13px}
        .status-pill,.stage-pill{font-size:11px;font-weight:700;padding:3px 10px}
        .rp-eyebrow{font-size:11px;font-weight:700;letter-spacing:0.12em}
        .rp-card{border-radius:18px;border:1px solid ${d.border}}
        /* Buttons: coral for the main action, outlined for everything else */
        .btn-save,.ra-btn.fill,.doc-btn.fill,.dbp-save,.ab-btn{background:${ADMIN_CORAL};color:${ADMIN_INK};font-family:${ADMIN_FONTS.body};font-weight:700;font-size:13px;border-radius:999px;min-height:38px;padding:8px 18px;border:2px solid ${ADMIN_CORAL};transition:transform .15s,background .15s}
        .btn-save:hover:not(:disabled),.ra-btn.fill:hover,.doc-btn.fill:hover,.dbp-save:hover:not(:disabled),.ab-btn:hover:not(:disabled){background:#FF8467;border-color:#FF8467;opacity:1}
        .btn-save:disabled,.dbp-save:disabled,.ab-btn:disabled,.doc-btn:disabled,.ra-btn:disabled{opacity:.45;cursor:not-allowed}
        .btn-cancel{font-family:${ADMIN_FONTS.body};font-weight:600;font-size:13px;border-radius:999px;min-height:38px;padding:8px 18px;border-color:${d.border2}!important;color:${d.text}!important;background:transparent}
        .btn-cancel:hover{border-color:${d.text}!important}
        .ra-btn{border-radius:999px;font-size:13px;font-weight:600;min-height:42px}
        .doc-btn{border-radius:999px;font-size:13px;font-weight:600;min-height:38px}
        .cr-btn{font-size:12px;font-weight:600;padding:6px 12px;min-height:30px}
        .add-row-btn{font-size:13px;font-weight:700;padding:9px 16px;border-radius:999px!important}
        .icon-btn{min-width:30px;min-height:30px;border-radius:8px;color:${d.text2}}
        .icon-btn:hover{background:${d.accentBg}}
        /* Fields */
        .shell input,.shell select,.shell textarea{font-family:${ADMIN_FONTS.body};color:${d.text}}
        .shell input::placeholder,.shell textarea::placeholder{color:${d.text3};opacity:1}
        .shell select option{background:${d.white};color:${d.text}}
        .dbp-input,.ab-input,.hi-input,textarea.form-input{font-size:13px;padding:8px 11px;border-radius:10px;border-width:1.5px!important;border-color:${d.border2}!important;background:${d.surface}!important;color:${d.text}!important;min-height:38px}
        .shell input:focus,.shell select:focus,.shell textarea:focus{border-color:${d.accent}!important}
        .shell input[type=date],.shell input[type=time]{color-scheme:dark}
        .hi-track{border-color:${d.border2}!important}
        /* Keyboard focus, always visible */
        .shell :focus-visible{outline:3px solid ${d.accent};outline-offset:2px}
        .shell input:focus-visible,.shell select:focus-visible,.shell textarea:focus-visible{outline:2px solid ${d.accent};outline-offset:1px}
        .admin-skip{position:absolute;left:-999px;top:8px;z-index:2000;background:${ADMIN_CORAL};color:${ADMIN_INK};padding:8px 14px;border-radius:999px;font-weight:700}
        .admin-skip:focus{left:96px}
        /* Tables scroll sideways instead of squeezing */
        .data-table{overflow-x:auto;overflow-y:hidden}
        .dt-row:hover{background:rgba(255,138,112,0.07)}
        /* Modals */
        .admin-backdrop{backdrop-filter:blur(3px)}
        .admin-modal{border-radius:22px!important;box-shadow:0 24px 60px rgba(0,0,0,.5);max-height:calc(100vh - 32px);overflow-y:auto}
        .admin-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1200;background:${d.white};color:${d.text};border:1px solid ${d.border2};border-radius:14px;padding:12px 16px;font-size:13px;box-shadow:0 12px 32px rgba(0,0,0,.4);max-width:calc(100vw - 32px)}
        @media (prefers-reduced-motion: reduce){.shell *{transition:none!important;animation:none!important}.booking-card:hover{transform:none}}
        /* Narrower screens: panel below content */
        @media (max-width:1180px){.main{grid-template-columns:1fr 300px!important}}
        /* Phones and small tablets: bottom navigation, single column */
        @media (max-width:900px){
          html,body{height:auto;overflow:auto}
          .admin-frame{display:block;height:auto}
          .shell{display:block!important;height:auto!important;overflow:visible!important;padding-bottom:84px}
          .sidebar{position:fixed;left:0;right:0;bottom:0;z-index:900;flex-direction:row;height:74px;padding:6px 8px;border-right:none!important;border-top:1px solid ${d.border}}
          .sb-logo,.sb-admin-wrap,.sb-divider{display:none!important}
          .sb-nav{flex-direction:row;justify-content:space-around;padding:0;flex:1}
          .sb-btn{width:58px;height:58px}
          .sb-btn[aria-current=page]::before{left:14px;right:14px;top:-6px;bottom:auto;width:auto;height:3px}
          .sb-toggle{min-width:0;margin:0 2px!important;padding:6px}
          .sb-toggle-label{display:none}
          .main{display:block!important;height:auto!important;overflow:visible!important}
          .center{overflow:visible;padding:20px 16px 8px}
          .panel{border-left:none!important;border-top:1px solid ${d.border};overflow:visible}
          .panel-inner{padding:20px 16px}
          .admin-topbar{display:flex!important}
          .stat-row,.stat-row-3{grid-template-columns:1fr 1fr}
          .form-grid,.form-grid-3,.platform-bars,.dbp-add,.add-block-row{grid-template-columns:1fr!important}
          .booking-cards{grid-template-columns:1fr}
          .page-greeting{font-size:26px}
          .dt-header,.dt-row{min-width:620px}
          .doc-actions,.form-actions{flex-wrap:wrap}
          .admin-skip:focus{left:16px}
          .rp-empty{height:auto;padding:24px}
        }
        @media (max-width:420px){.stat-row,.stat-row-3{grid-template-columns:1fr}}
        /* Pages without a details panel use the full width */
        .main.no-panel{grid-template-columns:1fr!important}
        /* Website Care pages scroll inside the shell like the other pages */
        .care-frame{height:100%;overflow-y:auto;min-width:0}
        @media (max-width:900px){.care-frame{height:auto;overflow:visible}}
`
