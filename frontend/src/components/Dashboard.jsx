import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    LayoutDashboard,
    PenTool,
    Users,
    Send,
    BarChart2,
    Upload,
    FileSpreadsheet,
    Folder,
    Image as ImageIcon,
    Eye,
    EyeOff,
    CheckCircle,
    AlertCircle,
    ChevronRight,
    ChevronLeft,
    Bold,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Mail,
    FileText
} from 'lucide-react';
import '../App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function Dashboard() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({
        subject: '',
        body: '<p>Estimado(a) {{Nombre}},</p><p>Adjuntamos la información solicitada.</p>',
        footer: '<p style="text-align: center;">Saludos cordiales,<br/>Universidad Privada de Tacna</p>',
        senderEmail: '',
        senderPassword: ''
    });

    const [files, setFiles] = useState({
        excel: null,
        logo: null,
        flyer: null,
        attachmentFolder1: [],
        attachmentFolder2: []
    });

    const [preview, setPreview] = useState({
        excelCount: 0,
        logoUrl: null,
        flyerUrl: null
    });

    const [status, setStatus] = useState({ type: '', message: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [showReport, setShowReport] = useState(false);

    const showStatus = (type, message) => {
        setStatus({ type, message });
        setTimeout(() => setStatus({ type: '', message: '' }), 5000);
    };

    // Load data from sessionStorage on component mount
    useEffect(() => {
        const savedConfig = sessionStorage.getItem('emailConfig');
        const savedStep = sessionStorage.getItem('currentStep');
        const savedPreview = sessionStorage.getItem('preview');

        if (savedConfig) {
            setConfig(JSON.parse(savedConfig));
        }
        if (savedStep) {
            setStep(parseInt(savedStep));
        }
        if (savedPreview) {
            setPreview(JSON.parse(savedPreview));
        }
    }, []);

    // Save config to sessionStorage whenever it changes
    useEffect(() => {
        sessionStorage.setItem('emailConfig', JSON.stringify(config));
    }, [config]);

    // Save step to sessionStorage whenever it changes
    useEffect(() => {
        sessionStorage.setItem('currentStep', step.toString());
    }, [step]);

    // Save preview to sessionStorage whenever it changes
    useEffect(() => {
        sessionStorage.setItem('preview', JSON.stringify(preview));
    }, [preview]);

    const fetchReport = async () => {
        try {
            const response = await axios.get(`${API_URL}/get-report`);
            if (response.data.report && response.data.report.length > 0) {
                setReportData(response.data.report);
                setShowReport(true);
                showStatus('success', `📊 Reporte cargado: ${response.data.total} registros`);
            } else {
                showStatus('error', '⏳ El reporte aún no está disponible');
            }
        } catch (error) {
            showStatus('error', 'Error al cargar reporte');
        }
    };

    const handleClear = async () => {
        if (!window.confirm("¿Estás seguro de que quieres limpiar todos los campos? Se perderá la configuración actual.")) {
            return;
        }

        try {
            await axios.post(`${API_URL}/clear-campaign`);

            // Clear sessionStorage
            sessionStorage.removeItem('emailConfig');
            sessionStorage.removeItem('currentStep');
            sessionStorage.removeItem('preview');

            // Force reload to clear all states and file inputs
            window.location.reload();

        } catch (error) {
            console.error(error);
            showStatus('error', 'Error al limpiar campos');
        }
    };

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        const endpoint = type === 'excel' ? '/upload/excel' : '/upload/asset';

        axios.post(`${API_URL}${endpoint}`, formData)
            .then(res => {
                setFiles({ ...files, [type]: file });
                if (type === 'excel') {
                    setPreview({ ...preview, excelCount: res.data.count });
                    showStatus('success', `✅ Excel cargado: ${res.data.count} destinatarios`);
                } else if (type === 'logo') {
                    // Fix: Use root URL for temp assets, not API_URL
                    const baseUrl = API_URL.replace('/api', '');
                    setPreview({ ...preview, logoUrl: res.data.path ? `${baseUrl}/${res.data.path}` : URL.createObjectURL(file) });
                } else if (type === 'flyer') {
                    // Fix: Use root URL for temp assets, not API_URL
                    const baseUrl = API_URL.replace('/api', '');
                    setPreview({ ...preview, flyerUrl: res.data.path ? `${baseUrl}/${res.data.path}` : URL.createObjectURL(file) });
                }
            })
            .catch(err => showStatus('error', '❌ Error al subir archivo'))
            .finally(() => setLoading(false));
    };

    const handleFolderUpload = (e, folderType) => {
        const uploadedFiles = Array.from(e.target.files);
        if (uploadedFiles.length === 0) return;

        setLoading(true);
        const formData = new FormData();
        uploadedFiles.forEach(file => {
            formData.append('files', file);
        });

        // folderType is attachmentFolder1 or attachmentFolder2
        // backend expects 'folder1' or 'folder2'
        const backendType = folderType === 'attachmentFolder1' ? 'folder1' : 'folder2';
        formData.append('folder_type', backendType);

        axios.post(`${API_URL}/upload/assets-folder`, formData)
            .then(res => {
                setFiles({ ...files, [folderType]: uploadedFiles });
                showStatus('success', `✅ Carpeta cargada: ${res.data.count} archivos`);
            })
            .catch(err => showStatus('error', '❌ Error al subir carpeta'))
            .finally(() => setLoading(false));
    };

    const handleSend = async () => {
        setLoading(true);
        try {
            await axios.post(`${API_URL}/send`, {
                sender_email: config.senderEmail,
                password: config.senderPassword,
                subject: config.subject,
                body_html: config.body,
                footer_html: config.footer
            });
            showStatus('success', '🚀 ¡Envío masivo iniciado en segundo plano!');
            setStep(5);
        } catch (error) {
            showStatus('error', '❌ Error al iniciar el envío');
        } finally {
            setLoading(false);
        }
    };

    const insertTextFormat = (format, elementId) => {
        const textarea = document.getElementById(elementId);
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);

        let newText = '';
        if (format === 'bold') newText = `<b>${selectedText}</b>`;
        else if (format === 'center') newText = `<p style="text-align: center;">${selectedText}</p>`;
        else if (format === 'left') newText = `<p style="text-align: left;">${selectedText}</p>`;
        else if (format === 'right') newText = `<p style="text-align: right;">${selectedText}</p>`;

        const newValue = text.substring(0, start) + newText + text.substring(end);

        setConfig({
            ...config,
            [elementId === 'bodyTextarea' ? 'body' : 'footer']: newValue
        });
    };

    return (
        <div className="app-container">
            <header className="header">
                <div className="header-content">
                    <div className="logo-container">
                        <div className="logo">UPT</div>
                        <div className="logo-text">
                            <h1>Envío Masivo</h1>
                            <p>Universidad Privada de Tacna</p>
                        </div>
                    </div>
                    {status.message && (
                        <div className={`status-badge ${status.type === 'success' ? 'status-success' : 'status-error'}`}>
                            {status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                            {status.message}
                        </div>
                    )}
                </div>
            </header>

            <main className="main-content">
                <div className="dashboard-grid">
                    <aside className="sidebar">
                        <button className={`step-button ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)}>
                            <div className="step-icon"><LayoutDashboard size={18} /></div>
                            Configuración
                        </button>
                        <button className={`step-button ${step === 2 ? 'active' : ''}`} onClick={() => setStep(2)}>
                            <div className="step-icon"><PenTool size={18} /></div>
                            Diseño
                        </button>
                        <button className={`step-button ${step === 3 ? 'active' : ''}`} onClick={() => setStep(3)}>
                            <div className="step-icon"><Users size={18} /></div>
                            Destinatarios
                        </button>
                        <button className={`step-button ${step === 4 ? 'active' : ''}`} onClick={() => setStep(4)}>
                            <div className="step-icon"><Send size={18} /></div>
                            Enviar
                        </button>
                        <button className={`step-button ${step === 5 ? 'active' : ''}`} onClick={() => setStep(5)}>
                            <div className="step-icon"><BarChart2 size={18} /></div>
                            Reporte
                        </button>

                        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                            <button className="step-button" onClick={handleClear} style={{ color: '#ef4444' }}>
                                <div className="step-icon"><AlertCircle size={18} /></div>
                                Nueva Campaña
                            </button>
                        </div>
                    </aside>

                    <section className="content-card">
                        {step === 1 && (
                            <>
                                <div className="step-header">
                                    <h2 className="step-title"><LayoutDashboard size={28} /> Configuración de Envío</h2>
                                    <p className="step-subtitle">Credenciales y datos generales del correo</p>
                                </div>

                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label"><Mail size={16} /> Correo Remitente</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            placeholder="ejemplo@upt.edu.pe"
                                            value={config.senderEmail}
                                            onChange={e => setConfig({ ...config, senderEmail: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label"><EyeOff size={16} /> Contraseña</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                className="form-input"
                                                placeholder="••••••••••••"
                                                value={config.senderPassword}
                                                onChange={e => setConfig({ ...config, senderPassword: e.target.value })}
                                                style={{ paddingRight: '3rem' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '0.75rem',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#64748b'
                                                }}
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                        <small style={{ color: '#64748b', fontSize: '12px', marginTop: '0.25rem' }}>
                                            Gmail: usa "Contraseña de Aplicación". Otros: contraseña normal
                                        </small>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label"><FileText size={16} /> Asunto del Correo</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Ej: Constancia de Participación - Evento UPT"
                                        value={config.subject}
                                        onChange={e => setConfig({ ...config, subject: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <div className="step-header">
                                    <h2 className="step-title"><PenTool size={28} /> Diseño del Contenido</h2>
                                    <p className="step-subtitle">Personaliza la apariencia del correo electrónico</p>
                                </div>

                                <div className="form-grid">
                                    <div>
                                        <div className="form-group" style={{ marginBottom: '2rem' }}>
                                            <label className="form-label">Logo Institucional</label>
                                            <div className="upload-zone">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => handleFileChange(e, 'logo')}
                                                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', top: 0, left: 0 }}
                                                />
                                                {preview.logoUrl ? (
                                                    <img src={preview.logoUrl} alt="Logo" className="preview-image" />
                                                ) : (
                                                    <>
                                                        <div className="upload-icon"><ImageIcon size={32} /></div>
                                                        <div className="upload-text">Subir Logo</div>
                                                        <div className="upload-hint">PNG, JPG (Max 2MB)</div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Imagen Principal / Flyer</label>
                                            <div className="upload-zone">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => handleFileChange(e, 'flyer')}
                                                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', top: 0, left: 0 }}
                                                />
                                                {preview.flyerUrl ? (
                                                    <img src={preview.flyerUrl} alt="Flyer" className="preview-image" />
                                                ) : (
                                                    <>
                                                        <div className="upload-icon"><ImageIcon size={32} /></div>
                                                        <div className="upload-text">Subir Flyer</div>
                                                        <div className="upload-hint">PNG, JPG (Max 5MB)</div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="form-group">
                                            <label className="form-label">Cuerpo del Mensaje</label>

                                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                                <button type="button" className="btn btn-nav" onClick={() => insertTextFormat('left', 'bodyTextarea')} title="Izquierda">
                                                    <AlignLeft size={14} />
                                                </button>
                                                <button type="button" className="btn btn-nav" onClick={() => insertTextFormat('center', 'bodyTextarea')} title="Centro">
                                                    <AlignCenter size={14} />
                                                </button>
                                                <button type="button" className="btn btn-nav" onClick={() => insertTextFormat('right', 'bodyTextarea')} title="Derecha">
                                                    <AlignRight size={14} />
                                                </button>
                                                <button type="button" className="btn btn-nav" onClick={() => insertTextFormat('bold', 'bodyTextarea')} title="Negrita">
                                                    <Bold size={14} />
                                                </button>
                                            </div>

                                            <textarea
                                                id="bodyTextarea"
                                                className="form-input form-textarea"
                                                placeholder="<p>Hola {{Nombre}},</p>..."
                                                value={config.body}
                                                onChange={e => setConfig({ ...config, body: e.target.value })}
                                            ></textarea>
                                            <small style={{ color: '#64748b', fontSize: '12px', marginTop: '0.5rem' }}>
                                                💡 Usa variables como {'{{Nombre}}'} para personalizar
                                            </small>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Pie de Página (Footer)</label>
                                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                <button type="button" className="btn btn-nav" onClick={() => insertTextFormat('center', 'footerTextarea')}>
                                                    <AlignCenter size={14} /> Centro
                                                </button>
                                            </div>
                                            <textarea
                                                id="footerTextarea"
                                                className="form-input form-textarea"
                                                placeholder="<p style='text-align: center;'>Saludos,<br/>UPT</p>"
                                                value={config.footer}
                                                onChange={e => setConfig({ ...config, footer: e.target.value })}
                                                style={{ minHeight: '100px' }}
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>

                                <div className="email-preview">
                                    <div className="email-preview-header">
                                        {preview.logoUrl && <img src={preview.logoUrl} alt="Logo" className="preview-logo" />}
                                        <div style={{ fontWeight: '700', fontSize: '18px' }}>
                                            {config.subject || 'Asunto del correo'}
                                        </div>
                                    </div>
                                    <div className="email-preview-body">
                                        <div dangerouslySetInnerHTML={{ __html: config.body }} />
                                        {preview.flyerUrl && <img src={preview.flyerUrl} alt="Flyer" className="preview-flyer" />}
                                        <div dangerouslySetInnerHTML={{ __html: config.footer }} style={{ marginTop: '1rem' }} />
                                    </div>
                                </div>
                            </>
                        )}

                        {step === 3 && (
                            <>
                                <div className="step-header">
                                    <h2 className="step-title"><Users size={28} /> Destinatarios y Archivos</h2>
                                    <p className="step-subtitle">Carga la lista de correos y archivos adjuntos</p>
                                </div>

                                <div className="excel-card">
                                    <h3><FileSpreadsheet size={20} /> Lista de Destinatarios</h3>
                                    <p>Sube un archivo Excel (.xlsx) con las columnas: Correo, Nombre, etc.</p>
                                    <label className="btn btn-primary">
                                        {loading ? '⏳ Cargando...' : <><Upload size={16} /> Seleccionar Excel</>}
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={(e) => handleFileChange(e, 'excel')}
                                            style={{ display: 'none' }}
                                            disabled={loading}
                                        />
                                    </label>
                                    {files.excel && (
                                        <div className="file-badge" style={{ marginLeft: '1rem' }}>
                                            <CheckCircle size={14} /> {files.excel.name} ({preview.excelCount} destinatarios)
                                        </div>
                                    )}
                                </div>

                                <div className="form-grid">
                                    <div className="folder-card">
                                        <div className="folder-header">
                                            <Folder size={24} color="#2D366F" />
                                            <h3>Carpeta Adjuntos 1</h3>
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '1.5rem' }}>
                                            Archivos ordenados por número (1_archivo.pdf, 2_archivo.docx...)
                                        </p>
                                        <label className="btn btn-nav" style={{ width: '100%' }}>
                                            {loading ? '⏳ Cargando...' : 'Seleccionar Carpeta'}
                                            <input
                                                type="file"
                                                webkitdirectory=""
                                                directory=""
                                                multiple
                                                onChange={(e) => handleFolderUpload(e, 'attachmentFolder1')}
                                                style={{ display: 'none' }}
                                                disabled={loading}
                                            />
                                        </label>
                                        {files.attachmentFolder1.length > 0 && (
                                            <div style={{ marginTop: '1rem', fontWeight: '600', color: '#16a34a', fontSize: '13px' }}>
                                                ✅ {files.attachmentFolder1.length} archivos listos
                                            </div>
                                        )}
                                    </div>

                                    <div className="folder-card">
                                        <div className="folder-header">
                                            <Folder size={24} color="#2D366F" />
                                            <h3>Carpeta Adjuntos 2</h3>
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '1.5rem' }}>
                                            Segunda ronda de archivos (Opcional)
                                        </p>
                                        <label className="btn btn-nav" style={{ width: '100%' }}>
                                            {loading ? '⏳ Cargando...' : 'Seleccionar Carpeta'}
                                            <input
                                                type="file"
                                                webkitdirectory=""
                                                directory=""
                                                multiple
                                                onChange={(e) => handleFolderUpload(e, 'attachmentFolder2')}
                                                style={{ display: 'none' }}
                                                disabled={loading}
                                            />
                                        </label>
                                        {files.attachmentFolder2.length > 0 && (
                                            <div style={{ marginTop: '1rem', fontWeight: '600', color: '#16a34a', fontSize: '13px' }}>
                                                ✅ {files.attachmentFolder2.length} archivos listos
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {step === 4 && (
                            <div className="send-container">
                                <div className="send-icon">
                                    {loading ? <span className="loading-spinner"><Upload size={40} /></span> : <Send size={40} />}
                                </div>
                                <h2 className="step-title" style={{ justifyContent: 'center' }}>
                                    {loading ? '¡Enviando Correos!' : '¿Listo para enviar?'}
                                </h2>
                                <p style={{ fontSize: '16px', color: '#64748b', marginBottom: '1rem' }}>
                                    Se enviarán correos a <span className="send-count">{preview.excelCount}</span> destinatarios
                                </p>
                                <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '3rem' }}>
                                    Los correos inválidos se saltarán automáticamente
                                </p>

                                {!loading && (
                                    <button
                                        className="btn btn-success"
                                        onClick={handleSend}
                                        disabled={loading}
                                    >
                                        Iniciar Envío Masivo
                                    </button>
                                )}

                                {loading && (
                                    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                                        <p style={{ color: '#2D366F', fontWeight: '700' }}>
                                            ⏳ Procesando envíos... Por favor espera.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 5 && (
                            <div>
                                <div className="step-header">
                                    <h2 className="step-title"><BarChart2 size={28} /> Reporte de Envíos</h2>
                                    <p className="step-subtitle">Evidencia detallada de cada envío realizado</p>
                                </div>

                                <button
                                    className="btn btn-primary"
                                    onClick={fetchReport}
                                    style={{ marginBottom: '1.5rem' }}
                                >
                                    🔄 Actualizar Reporte
                                </button>

                                {reportData.length > 0 ? (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{
                                            width: '100%',
                                            borderCollapse: 'collapse',
                                            fontSize: '13px'
                                        }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#f1f5f9', color: '#334155', textAlign: 'left' }}>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Correo</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Nombre</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Estado</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Fecha</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Hora</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Intentos</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Duración (s)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportData.map((row, index) => (
                                                    <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                        <td style={{ padding: '12px' }}>{row.correo}</td>
                                                        <td style={{ padding: '12px' }}>{row.nombre}</td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                            <span style={{
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                backgroundColor: row.estado === 'Enviado' ? '#dcfce7' : '#fee2e2',
                                                                color: row.estado === 'Enviado' ? '#166534' : '#991b1b',
                                                                fontWeight: '600',
                                                                fontSize: '12px'
                                                            }}>
                                                                {row.estado}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>{row.fecha}</td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>{row.hora}</td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>{row.intentos}</td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>{row.duracion}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '3rem',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '8px',
                                        border: '1px dashed #cbd5e1'
                                    }}>
                                        <p style={{ fontSize: '16px', color: '#64748b' }}>
                                            📭 No hay datos de reporte disponibles aún
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="navigation">
                            <button
                                className="btn btn-nav btn-back"
                                onClick={() => setStep(step - 1)}
                                disabled={step === 1 || loading}
                            >
                                <ChevronLeft size={16} /> Anterior
                            </button>

                            {step < 5 && (
                                <button
                                    className="btn btn-next"
                                    onClick={() => setStep(step + 1)}
                                    disabled={loading}
                                >
                                    Siguiente <ChevronRight size={16} />
                                </button>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
