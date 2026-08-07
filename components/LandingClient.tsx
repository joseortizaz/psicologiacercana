"use client";

import { useEffect, useRef } from "react";
import "@/app/landing.css";

const LANDING_HTML = `
<header>
  <div class="wrap nav-row">
    <a href="/" class="brand">
      <img src="/brand/logo-cercana-compact.png" alt="Cercana" style="height:32px;width:auto;" />
    </a>

    <nav class="primary">
      <a href="#beneficios">Características</a>
      <a href="#beneficios">Beneficios</a>
      <a href="#planes">Planes</a>
      <a href="#seguridad">Seguridad</a>
      <a href="#recursos">Recursos</a>
      <a href="#contacto">Contacto</a>
    </nav>

    <div class="nav-actions">
      <a href="/login" class="login-link">Iniciar sesión</a>
      <a href="/registro" class="btn btn-primary btn-sm">Prueba gratuita 14 días</a>
      <button class="menu-toggle" onclick="window.__cercanaToggleNav()" aria-label="Abrir menú">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#173A3F" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
    </div>
  </div>
  <div class="mobile-nav">
    <a href="#beneficios">Características</a>
    <a href="#beneficios">Beneficios</a>
    <a href="#planes">Planes</a>
    <a href="#seguridad">Seguridad</a>
    <a href="#recursos">Recursos</a>
    <a href="#contacto">Contacto</a>
    <div class="mobile-cta">
      <a href="/login" class="btn btn-outline btn-block">Iniciar sesión</a>
      <a href="/registro" class="btn btn-primary btn-block">Prueba gratuita 14 días</a>
    </div>
  </div>
</header>

<!-- ================= HERO ================= -->
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <h1>Tu práctica,<br>en <span class="accent">buenas manos.</span></h1>
      <p class="hero-sub">Cercana es la plataforma todo en uno para psicólogos y psiquiatras que buscan brindar una atención ética, segura y eficiente.</p>

      <ul class="check-list">
        <li><span class="tick">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7C9885" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span> Más tiempo para tus pacientes</li>
        <li><span class="tick">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7C9885" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span> Gestión clínica simple y profesional</li>
        <li><span class="tick">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7C9885" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span> Cumplimiento legal en República Dominicana</li>
      </ul>

      <div class="hero-ctas">
        <a href="#planes" class="btn btn-primary">Comienza tu prueba gratuita</a>
        <a href="#recursos" class="btn btn-outline">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#173A3F"><polygon points="6,4 20,12 6,20"/></svg>
          Conoce más
        </a>
      </div>

      <div class="trust-line">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
        Tus datos están protegidos. Siempre.
      </div>
    </div>

    <div class="mockup-stage">
      <div class="mockup-card mockup-desktop">
        <div class="mockup-topbar"><span></span><span></span><span></span></div>
        <div class="mockup-body">
          <div class="mockup-sidebar">
            <i></i><i></i><i style="width:80%"></i><i style="width:50%"></i><i style="width:65%"></i>
          </div>
          <div class="mockup-main">
            <div class="mockup-stats">
              <div><b>12</b><small>Pacientes</small></div>
              <div><b>5</b><small>Hoy</small></div>
              <div><b>3</b><small>Pendientes</small></div>
            </div>
            <div class="mockup-rows">
              <i></i><i></i><i></i>
            </div>
          </div>
        </div>
      </div>

      <div class="mockup-card mockup-tablet">
        <div class="mockup-topbar"><span></span><span></span></div>
        <div class="mockup-tablet-body">
          <div class="avatar-circle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C9885" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>
          </div>
          <div class="mockup-tablet-lines">
            <i></i><i style="width:40%"></i><i style="margin-top:6px"></i><i style="width:85%"></i><i style="width:65%"></i>
          </div>
        </div>
      </div>

      <div class="mockup-card mockup-phone">
        <div class="mockup-topbar"><span></span></div>
        <div class="mockup-phone-body">
          <b>Consentimiento informado</b>
          <div class="signature-box">
            <svg viewBox="0 0 140 34" fill="none" stroke="#173A3F" stroke-width="2" stroke-linecap="round">
              <path d="M6 26c6-14 10-14 14 0 4-18 8-18 12-2 3-10 6-10 9 1 3-14 7-14 10 0 3-9 6-9 9 2 3-13 6-13 9-1"/>
            </svg>
            <div class="signature-cta">Firmar y aceptar</div>
          </div>
        </div>
      </div>

      <div class="floating-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C9885" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Firma con validez legal
      </div>
    </div>
  </div>
</section>

<!-- ================= RIBBON ================= -->
<div class="ribbon">
  <div class="wrap ribbon-row">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#B3532E" stroke="none"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2.3 4 6.4 4c2 0 3.7 1.1 4.6 2.7C11.9 5.1 13.6 4 15.6 4c4.1 0 6 4 4.4 7.7C19.5 16.4 12 21 12 21z"/></svg>
    Creado para profesionales de la salud mental en República Dominicana
    <img src="/brand/flag-dominicana.webp" alt="Bandera de República Dominicana" width="16" height="16" style="flex:none;object-fit:contain;" />
  </div>
</div>

<!-- ================= BENEFICIOS ================= -->
<section id="beneficios">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Beneficios clave</p>
      <h2>Todo lo que necesitas para una práctica más profesional</h2>
    </div>

    <div class="benefits-grid">
      <div class="benefit-card">
        <div class="benefit-icon ic-sage">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
        </div>
        <h3>Expedientes clínicos completos</h3>
        <p>Historiales, notas, diagnósticos y planes de tratamiento organizados y seguros.</p>
      </div>

      <div class="benefit-card">
        <div class="benefit-icon ic-deep">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <h3>Agenda inteligente</h3>
        <p>Gestiona citas, recordatorios y seguimientos de forma automática y sencilla.</p>
      </div>

      <div class="benefit-card featured">
        <div class="benefit-icon ic-sage">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </div>
        <h3>Consentimientos con firma digital y legal</h3>
        <p>Firma electrónica avanzada con validez legal en República Dominicana, respaldada por la Ley 126-02.</p>
      </div>

      <div class="benefit-card">
        <div class="benefit-icon ic-clay">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        </div>
        <h3>Reportes y estadísticas</h3>
        <p>Visualiza el crecimiento de tu práctica y toma decisiones basadas en datos.</p>
      </div>

      <div class="benefit-card">
        <div class="benefit-icon ic-deep">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <h3>Gestión de pacientes</h3>
        <p>Organiza tu base de pacientes y toda la información relevante en un solo lugar.</p>
      </div>

      <div class="benefit-card">
        <div class="benefit-icon ic-sage">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><rect x="9.5" y="14" width="5" height="4" rx="1"/><path d="M12 14v-2"/></svg>
        </div>
        <h3>Acceso seguro desde cualquier lugar</h3>
        <p>Trabaja de forma segura desde cualquier dispositivo, estés donde estés.</p>
      </div>
    </div>
  </div>
</section>

<!-- ================= SEGURIDAD ================= -->
<section id="seguridad">
  <div class="wrap">
    <div class="compliance">
      <div>
        <div class="compliance-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
        </div>
        <p class="eyebrow">Cumplimiento y seguridad</p>
        <h2>Cumplimos con las normativas de salud y protección de datos de República Dominicana</h2>
      </div>

      <ul class="compliance-list">
        <li>
          <span class="tick"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
          <span><b>Ley No. 172-13</b><em>Protección integral de datos personales</em></span>
        </li>
        <li>
          <span class="tick"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
          <span><b>Ley No. 42-01 General de Salud</b><em>Confidencialidad e intimidad del paciente</em></span>
        </li>
        <li>
          <span class="tick"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
          <span><b>Ley No. 126-02</b><em>Validez legal de la firma electrónica, regulada por INDOTEL</em></span>
        </li>
        <li>
          <span class="tick"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
          <span><b>Ética profesional</b><em>Estándares de confidencialidad clínica y buenas prácticas</em></span>
        </li>
      </ul>
    </div>
  </div>
</section>

<!-- ================= PLANES ================= -->
<section id="planes">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Planes flexibles</p>
      <h2>Elige el plan que se adapta a tu práctica</h2>
      <p>Todos los planes incluyen: expedientes clínicos, agenda, firma digital de consentimientos, reportes y más.</p>
    </div>

    <div class="billing-toggle">
      <button id="btn-monthly" class="active" onclick="window.__cercanaSetBilling('monthly')">Pago mensual</button>
      <button id="btn-annual" onclick="window.__cercanaSetBilling('annual')">Pago anual <span class="save-pill">Ahorra 15%</span></button>
    </div>

    <div class="pricing-grid">

      <!-- Plan A -->
      <div class="plan-card">
        <div class="plan-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>
        </div>
        <p class="plan-letter">PLAN A</p>
        <p class="plan-name">Esencial</p>
        <p class="plan-tag">Terapeuta independiente</p>
        <div class="plan-price-wrap">
          <p class="plan-price monthly-price"><b>RD$ 990</b><small>/mes</small></p>
          <p class="plan-price annual-price" style="display:none"><b>RD$ 10,098</b><small>/año</small></p>
          <p class="plan-save annual-price" style="display:none">Ahorras RD$ 1,782 al año</p>
        </div>
        <hr class="plan-divider">
        <ul class="plan-features">
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 1 terapeuta</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Expediente clínico y agenda</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Firma digital de consentimientos</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Soporte por correo</li>
        </ul>
        <a href="#contacto" class="btn btn-outline btn-block">Comenzar ahora</a>
      </div>

      <!-- Plan B -->
      <div class="plan-card">
        <div class="plan-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <p class="plan-letter">PLAN B</p>
        <p class="plan-name">Dúo Clínico</p>
        <p class="plan-tag">Dos terapeutas</p>
        <div class="plan-price-wrap">
          <p class="plan-price monthly-price"><b>RD$ 1,590</b><small>/mes</small></p>
          <p class="plan-price annual-price" style="display:none"><b>RD$ 16,218</b><small>/año</small></p>
          <p class="plan-save annual-price" style="display:none">Ahorras RD$ 2,862 al año</p>
        </div>
        <hr class="plan-divider">
        <ul class="plan-features">
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 2 terapeutas</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Todo lo del plan Esencial</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Agenda compartida</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Soporte prioritario</li>
        </ul>
        <a href="#contacto" class="btn btn-outline btn-block">Comenzar ahora</a>
      </div>

      <!-- Plan C -->
      <div class="plan-card popular">
        <div class="plan-badge">Más popular</div>
        <div class="plan-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <p class="plan-letter">PLAN C</p>
        <p class="plan-name">Profesional Plus</p>
        <p class="plan-tag">Equipo pequeño: 3 a 5 terapeutas</p>
        <div class="plan-price-wrap">
          <p class="plan-price monthly-price"><b>RD$ 2,590</b><small>/mes</small></p>
          <p class="plan-price annual-price" style="display:none"><b>RD$ 26,418</b><small>/año</small></p>
          <p class="plan-save annual-price" style="display:none">Ahorras RD$ 4,662 al año</p>
        </div>
        <hr class="plan-divider">
        <ul class="plan-features">
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 3 a 5 terapeutas</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 1 administrador</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 1 asistente administrativa</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 1 supervisor clínico</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Reportes avanzados</li>
        </ul>
        <a href="#contacto" class="btn btn-dark btn-block">Comenzar ahora</a>
      </div>

      <!-- Plan D -->
      <div class="plan-card">
        <div class="plan-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg>
        </div>
        <p class="plan-letter">PLAN D</p>
        <p class="plan-name">Clínica en Crecimiento</p>
        <p class="plan-tag">6 a 10 terapeutas</p>
        <div class="plan-price-wrap">
          <p class="plan-price monthly-price"><b>RD$ 4,490</b><small>/mes</small></p>
          <p class="plan-price annual-price" style="display:none"><b>RD$ 45,798</b><small>/año</small></p>
          <p class="plan-save annual-price" style="display:none">Ahorras RD$ 8,082 al año</p>
        </div>
        <hr class="plan-divider">
        <ul class="plan-features">
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 6 a 10 terapeutas</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 1 administrador</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 2 asistentes administrativas</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 2 supervisores clínicos</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Reportes avanzados</li>
        </ul>
        <a href="#contacto" class="btn btn-outline btn-block">Comenzar ahora</a>
      </div>

      <!-- Plan E -->
      <div class="plan-card">
        <div class="plan-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M6 21V9l6-6 6 6v12"/><path d="M10 21v-6h4v6"/><path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/></svg>
        </div>
        <p class="plan-letter">PLAN E</p>
        <p class="plan-name">Institucional</p>
        <p class="plan-tag">Equipos en desarrollo: 11 o más terapeutas</p>
        <div class="plan-price-wrap">
          <p class="plan-custom">A medida</p>
        </div>
        <hr class="plan-divider">
        <ul class="plan-features">
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Planes personalizados</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Roles y permisos flexibles</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Acompañamiento dedicado</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Integración con tu clínica</li>
        </ul>
        <a href="#contacto" class="btn btn-dark btn-block">Contactar a servicio</a>
      </div>

    </div>

    <p class="pricing-note">Precios en pesos dominicanos (RD$). Puedes cambiar de plan o cancelar cuando quieras.</p>
  </div>
</section>

<!-- ================= PROPÓSITO ================= -->
<section id="recursos">
  <div class="wrap">
    <div class="purpose">
      <div class="purpose-art">
        <svg width="220" height="220" viewBox="0 0 220 220" fill="none">
          <circle cx="110" cy="110" r="86" fill="rgba(124,152,133,.18)"/>
          <path d="M70 150v-38c0-22 18-40 40-40s40 18 40 40v38" stroke="#7C9885" stroke-width="4" fill="none" stroke-linecap="round"/>
          <rect x="60" y="150" width="100" height="14" rx="7" fill="#7C9885" opacity=".5"/>
          <path d="M110 72c-12 0-14 24 0 32 14-8 12-32 0-32z" fill="#F0EBE1"/>
          <path d="M92 116c8 8 28 8 36 0" stroke="#F0EBE1" stroke-width="4" fill="none" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="purpose-copy">
        <p class="eyebrow">Nuestro propósito</p>
        <h2>Cuidar de quienes cuidan</h2>
        <p>Cercana existe para que tú puedas enfocarte en lo más importante: el bienestar de tus pacientes. Nosotros nos encargamos de la parte administrativa, legal y tecnológica.</p>
        <div class="purpose-ctas">
          <a href="/registro" class="btn btn-primary">Prueba gratuita 14 días</a>
          <a href="#contacto" class="link-arrow">Solicita una demostración
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ================= FOOTER ================= -->
<footer id="contacto">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="/" class="brand">
          <img src="/brand/logo-cercana-compact.png" alt="Cercana" style="height:28px;width:auto;" />
        </a>
        <p>Plataforma de gestión clínica diseñada para profesionales de la salud mental en República Dominicana.</p>
      </div>

      <div class="footer-col">
        <h4>Producto</h4>
        <ul>
          <li><a href="#beneficios">Características</a></li>
          <li><a href="#seguridad">Seguridad</a></li>
          <li><a href="#">Integraciones</a></li>
          <li><a href="#">Actualizaciones</a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>Recursos</h4>
        <ul>
          <li><a href="#">Blog</a></li>
          <li><a href="#">Guías</a></li>
          <li><a href="#">Preguntas frecuentes</a></li>
          <li><a href="#">Webinars</a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>Empresa</h4>
        <ul>
          <li><a href="#">Sobre nosotros</a></li>
          <li><a href="mailto:info@cercanard.com">info@cercanard.com</a></li>
          <li><a href="https://wa.me/18293748878" target="_blank" rel="noreferrer">WhatsApp: 829-374-8878</a></li>
          <li><a href="/terminos">Términos y condiciones</a></li>
          <li><a href="/privacidad">Política de privacidad</a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>Síguenos</h4>
        <div class="social-row">
          <a href="https://wa.me/18293748878" target="_blank" rel="noreferrer" aria-label="WhatsApp"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.14h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.37c0-4.53 3.69-8.22 8.24-8.22 2.2 0 4.27.86 5.82 2.42a8.17 8.17 0 0 1 2.41 5.81c0 4.53-3.69 8.22-8.22 8.22Zm4.51-6.16c-.25-.12-1.46-.72-1.68-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.96-.14.16-.29.18-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42h-.48c-.16 0-.43.06-.65.31-.23.25-.85.83-.85 2.03s.87 2.36 1 2.52c.12.16 1.7 2.6 4.13 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.08.14-1.18-.06-.11-.22-.17-.47-.29Z"/></svg></a>
          <a href="#" aria-label="Facebook"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.2-1.5 1.6-1.5H17V3.7C16.6 3.6 15.4 3.5 14 3.5c-2.8 0-4.7 1.7-4.7 4.9v2.5H6.6V14h2.7v7h4.2z"/></svg></a>
          <a href="#" aria-label="Instagram"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg></a>
          <a href="#" aria-label="LinkedIn"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6.94 8.5H3.56V21h3.38V8.5zM5.25 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM21 21v-7.1c0-3.4-1.8-5-4.3-5-2 0-2.9 1.1-3.4 1.9V8.5H10v12.5h3.4v-7c0-.4 0-.7.1-1 .3-.7 1-1.5 2.1-1.5 1.5 0 2.1 1.1 2.1 2.8v6.7H21z"/></svg></a>
        </div>
        <div class="made-in">
          <img src="/brand/flag-dominicana.webp" alt="Bandera de República Dominicana" width="16" height="16" style="flex:none;object-fit:contain;" />
          Hecho en República Dominicana
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <span>© 2026 Cercana. Todos los derechos reservados.</span>
      <span>Santo Domingo, R.D.</span>
    </div>
  </div>
</footer>
`;

export function LandingClient() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = window as unknown as {
      __cercanaToggleNav?: () => void;
      __cercanaSetBilling?: (mode: "monthly" | "annual") => void;
    };

    w.__cercanaToggleNav = () => {
      rootRef.current?.classList.toggle("nav-open");
    };

    w.__cercanaSetBilling = (mode: "monthly" | "annual") => {
      const root = rootRef.current;
      if (!root) return;
      const isAnnual = mode === "annual";
      root.querySelector("#btn-monthly")?.classList.toggle("active", !isAnnual);
      root.querySelector("#btn-annual")?.classList.toggle("active", isAnnual);
      root.querySelectorAll<HTMLElement>(".monthly-price").forEach((el) => {
        el.style.display = isAnnual ? "none" : "flex";
      });
      root.querySelectorAll<HTMLElement>(".annual-price").forEach((el) => {
        el.style.display = isAnnual ? (el.classList.contains("plan-save") ? "block" : "flex") : "none";
      });
    };

    return () => {
      delete w.__cercanaToggleNav;
      delete w.__cercanaSetBilling;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="cercana-landing"
      dangerouslySetInnerHTML={{ __html: LANDING_HTML }}
    />
  );
}
