import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { treeAPI } from '../../utils/api';

const ContentTree = ({ onSelectLecture }) => {
	const [tree, setTree] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [expandedItems, setExpandedItems] = useState({});
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedMaterial, setSelectedMaterial] = useState(null);
	const [selectedInstructor, setSelectedInstructor] = useState(null);

	// تحميل شجرة المحتوى
	useEffect(() => {
		const loadTree = async () => {
			try {
				setLoading(true);
				const response = await treeAPI.getContentTree();
				setTree(response.data);
				
				// توسيع العنصر الأول تلقائياً
				if (response.data.length > 0) {
					setExpandedItems(prev => ({ ...prev, [response.data[0]._id]: true }));
					setSelectedMaterial(response.data[0]._id);
				}
			} catch (err) {
				setError(err.message || 'حدث خطأ في تحميل المحتوى');
			} finally {
				setLoading(false);
			}
		};

		loadTree();
	}, []);

	// تبديل التوسيع
	const toggleExpand = useCallback((id, type) => {
		setExpandedItems(prev => ({
			...prev,
			[id]: !prev[id],
		}));

		// تحديث العنصر المحدد
		if (type === 'material') {
			setSelectedMaterial(id);
			setSelectedInstructor(null);
		} else if (type === 'instructor') {
			setSelectedInstructor(id);
		}
	}, []);

	// البحث في الشجرة
	const searchInTree = useMemo(() => {
		if (!searchQuery.trim()) return tree;

		const query = searchQuery.toLowerCase();
		return tree.map(material => {
			const filteredMaterial = { ...material };
			
			// تصفية المدربين
			filteredMaterial.instructors = material.instructors
				.map(instructor => {
					const filteredInstructor = { ...instructor };
					
					// تصفية الفصول
					filteredInstructor.chapters = instructor.chapters
						.map(chapter => {
							const filteredChapter = { ...chapter };
							
							// تصفية المحاضرات
							filteredChapter.lectures = chapter.lectures.filter(
								lecture => lecture.title.toLowerCase().includes(query)
							);
							
							return filteredChapter.lectures.length > 0 ? filteredChapter : null;
						})
						.filter(Boolean);
					
					return filteredInstructor.chapters.length > 0 ? filteredInstructor : null;
				})
				.filter(Boolean);
			
			return filteredMaterial.instructors.length > 0 ? filteredMaterial : null;
		}).filter(Boolean);
	}, [tree, searchQuery]);

	// عرض حالة التحميل
	const renderLoading = useMemo(() => (
		<div className="flex flex-col items-center justify-center p-8">
			<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
			<p className="text-gray-600">جاري تحميل المحتوى...</p>
		</div>
	), []);

	// عرض حالة الخطأ
	const renderError = useMemo(() => (
		<div className="flex flex-col items-center justify-center p-8 text-red-600">
			<svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<p className="font-semibold">خطأ في التحميل</p>
			<p className="text-sm mt-2">{error}</p>
		</div>
	), [error]);

	// عرض عنصر المادة
	const renderMaterial = useCallback((material) => (
		<div key={material._id} className="mb-3">
			<button
				onClick={() => toggleExpand(material._id, 'material')}
				className={`w-full text-right p-4 rounded-lg flex items-center justify-between transition-all duration-200 ${
					selectedMaterial === material._id
						? 'bg-blue-50 border border-blue-200'
						: 'bg-white border border-gray-200 hover:bg-gray-50'
				}`}
			>
				<div className="flex items-center">
					<div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center ml-3">
						<svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
							<path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
						</svg>
					</div>
					<div className="text-right">
						<span className="font-bold text-gray-800 block">{material.title}</span>
						<span className="text-sm text-gray-500">
							{material.instructors?.length || 0} مدرب
						</span>
					</div>
				</div>
				<div className="flex items-center space-x-2">
					{selectedMaterial === material._id && (
						<div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
					)}
					<svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
						expandedItems[material._id] ? 'rotate-90' : ''
					}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
					</svg>
				</div>
			</button>

			{/* المحتوى المتمدد */}
			{expandedItems[material._id] && (
				<div className="mt-2 ml-8 pl-4 border-l-2 border-blue-200 space-y-3">
					{material.instructors?.map((instructor) => (
						<div key={instructor._id} className="space-y-2">
							<button
								onClick={() => toggleExpand(instructor._id, 'instructor')}
								className={`w-full text-right p-3 rounded-lg flex items-center justify-between transition ${
									selectedInstructor === instructor._id
										? 'bg-gray-100'
										: 'hover:bg-gray-50'
								}`}
							>
								<div className="flex items-center">
									<div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center ml-2">
										<svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
										</svg>
									</div>
									<div>
										<span className="font-semibold text-gray-700 block">{instructor.title}</span>
										<span className="text-xs text-gray-500">
											{instructor.chapters?.length || 0} فصل
										</span>
									</div>
								</div>
								<svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
									expandedItems[instructor._id] ? 'rotate-90' : ''
								}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
								</svg>
							</button>

							{expandedItems[instructor._id] && (
								<div className="ml-6 pl-3 border-l border-gray-200 space-y-2">
									{instructor.chapters?.map((chapter) => (
										<div key={chapter._id} className="space-y-1">
											<button
												onClick={() => toggleExpand(chapter._id, 'chapter')}
												className="w-full text-right p-2 rounded flex items-center justify-between hover:bg-gray-50"
											>
												<div className="flex items-center">
													<svg className="w-4 h-4 ml-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
														<path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
													</svg>
													<span className="font-medium text-gray-700">{chapter.title}</span>
												</div>
												<svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
													expandedItems[chapter._id] ? 'rotate-90' : ''
												}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
												</svg>
											</button>

											{expandedItems[chapter._id] && (
												<div className="ml-4 pl-3 space-y-1">
													{chapter.lectures?.map((lecture) => (
														<button
															key={lecture._id}
															onClick={() => {
																onSelectLecture(lecture._id);
																// إضافة تأثير التحديد
																setTimeout(() => {
																	const element = document.querySelector(`[data-lecture="${lecture._id}"]`);
																	if (element) {
																		element.classList.add('bg-green-50');
																		setTimeout(() => element.classList.remove('bg-green-50'), 1000);
																	}
																}, 100);
															}}
															data-lecture={lecture._id}
															className="w-full text-right p-2 rounded flex items-center hover:bg-blue-50 group transition-colors"
														>
															<svg className="w-4 h-4 ml-2 text-gray-400 group-hover:text-blue-500" fill="currentColor" viewBox="0 0 20 20">
																<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
															</svg>
															<span className="flex-1 text-sm text-gray-600 group-hover:text-blue-700">
																{lecture.title}
															</span>
															<span className="text-xs text-gray-400 group-hover:text-blue-500">
																{lecture.duration || '--:--'}
															</span>
														</button>
													))}
												</div>
											)}
										</div>
									))}
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	), [expandedItems, selectedMaterial, selectedInstructor, toggleExpand, onSelectLecture]);

	if (loading) return renderLoading;
	if (error) return renderError;

	return (
		<div className="bg-white rounded-xl shadow-lg overflow-hidden h-full flex flex-col" dir="rtl">
			{/* الهيدر */}
			<div className="p-6 border-b">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-2xl font-bold text-gray-800 flex items-center">
						<svg className="w-6 h-6 ml-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
							<path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
						</svg>
						مكتبة المحتوى
					</h2>
					<div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
						{tree.length} مادة
					</div>
				</div>

				{/* شريط البحث */}
				<div className="relative">
					<input
						type="text"
						placeholder="ابحث في المحتوى..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
					/>
					<div className="absolute left-3 top-3">
						{searchQuery ? (
							<button
								onClick={() => setSearchQuery('')}
								className="text-gray-400 hover:text-gray-600"
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						) : (
							<svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
							</svg>
						)}
					</div>
				</div>
			</div>

			{/* قائمة المحتوى */}
			<div className="flex-1 overflow-y-auto p-4">
				{searchInTree.length > 0 ? (
					<div className="space-y-2">
						{searchInTree.map(renderMaterial)}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center h-full p-8 text-gray-500">
						<svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<p className="text-lg">لا توجد نتائج تطابق بحثك</p>
						<p className="text-sm mt-2">حاول استخدام كلمات أخرى</p>
					</div>
				)}
			</div>

			{/* الفوتر */}
			<div className="p-4 border-t bg-gray-50">
				<div className="flex items-center justify-between text-sm text-gray-600">
					<div className="flex items-center">
						<svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
						</svg>
						<span>إجمالي المحتوى: {tree.length} مادة تعليمية</span>
					</div>
					<button
						onClick={() => {
							// تصغير جميع العناصر
							setExpandedItems({});
							setSelectedMaterial(null);
							setSelectedInstructor(null);
						}}
						className="text-blue-600 hover:text-blue-800 flex items-center"
					>
						<svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
						</svg>
						تصغير الكل
					</button>
				</div>
			</div>
		</div>
	);
};

ContentTree.propTypes = {
	onSelectLecture: PropTypes.func.isRequired,
};

export default ContentTree;