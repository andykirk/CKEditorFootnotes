/**
 * Basic sample plugin inserting footnotes elements into CKEditor editing area.
 *
 * Version 1.0.9
 * https://github.com/andykirk/CKEditorFootnotes
 *
 */
// Register the plugin within the editor.
(function($) {
    "use strict";



    CKEDITOR.plugins.add( 'footnotes', {

        footnote_ids: [],
        requires: 'widget',
        icons: 'footnotes',


        // The plugin initialization logic goes inside this method.
        init: function(editor) {

            // Check for jQuery
            // @TODO - remove if/when JQ dep. is removed.
            if (typeof(window.jQuery) == 'undefined') {
                console.warn('jQuery required but undetected so quitting footnotes.');
                return false;
            }

            // Allow `cite` to be editable:
            CKEDITOR.dtd.$editable['cite'] = 1;

            // Add some CSS tweaks:
            var css = '.footnotes{background:#eee; padding:1px 15px;} .footnotes cite{font-style: normal;}';
            CKEDITOR.addCss(css);

            var $this = this;

            /*editor.on('saveSnapshot', function(evt) {
                console.log('saveSnapshot');
            });*/

            // Force a reorder on startup to make sure all vars are set: (e.g. footnotes store):
            editor.on('instanceReady', function(evt) {
                $this.reorderMarkers(editor);
            });

            // Add the reorder change event:
            editor.on('change', function(evt) {
                // Copy the footnotes_store as we may be doing a cut:
                if(!evt.editor.footnotes_tmp) {
                    evt.editor.footnotes_tmp = evt.editor.footnotes_store;
                }

                // Prevent no selection errors:
                if (!evt.editor.getSelection().getStartElement()) {
                    return;
                }
                // Don't reorder the markers if editing a cite:
                var footnote_section = evt.editor.getSelection().getStartElement().getAscendant('section');
                if (footnote_section && footnote_section.$.className.indexOf('footnotes') != -1) {
                    return;
                }
                // SetTimeout seems to be necessary (it's used in the core but can't be 100% sure why)
                setTimeout(function(){
                        $this.reorderMarkers(editor);
                    },
                    0
                );
            });

            // Build the initial footnotes widget editables definition:
            var prefix = editor.config.footnotesPrefix ? '-' + editor.config.footnotesPrefix : '';
            var def = {
                header: {
                    selector: 'header > *',
                    //allowedContent: ''
                    allowedContent: 'strong em span sub sup;'
                }
            };
            var contents = $('<div>' + editor.element.$.textContent + '</div>')
                     , l = contents.find('.footnotes li').length
                     , i = 1;
            for (i; i <= l; i++) {
                def['footnote_' + i] = {selector: '#footnote' + prefix + '-' + i + ' cite', allowedContent: 'a[href]; cite[*](*); strong em span br'};
            }

            // Register the footnotes widget.
            editor.widgets.add('footnotes', {

                // Minimum HTML which is required by this widget to work.
                requiredContent: 'section(footnotes)',

                // Check the elements that need to be converted to widgets.
                upcast: function(element) {
                    return element.name == 'section' && element.hasClass('footnotes');
                },

                editables: def
            });

            // Register the footnotemarker widget.
            editor.widgets.add('footnotemarker', {

                // Minimum HTML which is required by this widget to work.
                requiredContent: 'sup[data-footnote-id]',

                // Check the elements that need to be converted to widgets.
                upcast: function(element) {
                    return element.name == 'sup' && element.attributes['data-footnote-id'] != 'undefined';
                },
            });

            // Define an editor command that opens our dialog.
            editor.addCommand('footnotes', new CKEDITOR.dialogCommand('footnotesDialog', {
                // @TODO: This needs work:
                allowedContent: 'section[*](*);header[*](*);li[*];a[*];cite(*)[*];sup[*]',
                requiredContent: 'section[*](*);header[*](*);li[*];a[*];cite(*)[*];sup[*]'
            }));

            // Create a toolbar button that executes the above command.
            editor.ui.addButton('Footnotes', {

                // The text part of the button (if available) and tooptip.
                label: 'Insert Footnotes',

                // The command to execute on click.
                command: 'footnotes',

                // The button placement in the toolbar (toolbar group name).
                toolbar: 'insert'
            });

            // Register our dialog file. this.path is the plugin folder path.
            CKEDITOR.dialog.add('footnotesDialog', this.path + 'dialogs/footnotes.js');
        },


        build: function(footnote, is_new, editor) {
            var footnote_id;
            if (is_new) {
                // Generate new id:
                footnote_id = this.generateFootnoteId();
            } else {
                // Existing footnote id passed:
                footnote_id = footnote;
            }

            // Insert the marker:
            var footnote_marker = '<sup data-footnote-id="' + footnote_id + '">X</sup>';

            editor.insertHtml(footnote_marker);

            if (is_new) {
                editor.fire('lockSnapshot');
                this.addFootnote(this.buildFootnote(footnote_id, footnote, false, editor), editor);
                editor.fire('unlockSnapshot');
            }
            this.reorderMarkers(editor);
        },

        buildFootnote: function(footnote_id, footnote_text, data, editor) {
            var links   = '',
                footnote,
                letters = 'abcdefghijklmnopqrstuvwxyz',
                order   = data ? data.order.indexOf(footnote_id) + 1 : 1,
                prefix  = editor.config.footnotesPrefix ? '-' + editor.config.footnotesPrefix : '';

            if (data && data.occurrences[footnote_id] == 1) {
                links = '<a href="#footnote-marker' + prefix + '-' + order + '-1">^</a> ';
            } else if (data && data.occurrences[footnote_id] > 1) {
                var i = 0
                  , l = data.occurrences[footnote_id]
                  , n = l;
                for (i; i < l; i++) {
                    links += '<a href="#footnote-marker' + prefix + '-' + order + '-' + (i + 1) + '">' + letters.charAt(i) + '</a>';
                    if (i < l-1) {
                        links += ', ';
                    } else {
                        links += ' ';
                    }
                }
            }
            footnote = '<li id="footnote' + prefix + '-' + order + '" data-footnote-id="' + footnote_id + '"><sup>' + links + '</sup><cite>' + footnote_text + '</cite></li>';
            return footnote;
        },

        addFootnote: function(footnote, editor) {
            var $contents  = $(editor.editable().$);
            var $footnotes = $contents.find('.footnotes');

            if ($footnotes.length == 0) {
                var header_title = editor.config.footnotesTitle ? editor.config.footnotesTitle : 'Footnotes';
                var header_els = ['<h2>', '</h2>'];//editor.config.editor.config.footnotesHeaderEls
                if (editor.config.footnotesHeaderEls) {
                    header_els = editor.config.footnotesHeaderEls;
                }
                var container = '<section class="footnotes"><header>' + header_els[0] + header_title + header_els[1] + '</header><ol>' + footnote + '</ol></section>';
                // Move cursor to end of content:
                var range = editor.createRange();
                range.moveToElementEditEnd(range.root);
                editor.getSelection().selectRanges([range]);
                // Insert the container:
                editor.insertHtml(container);
            } else {
                $footnotes.find('ol').append(footnote);
            }
        },

        generateFootnoteId: function() {
            var id = Math.random().toString(36).substr(2, 5);
            while ($.inArray(id, this.footnote_ids) != -1) {
                id = String(this.generateFootnoteId());
            }
            this.footnote_ids.push(id);
            return id;
        },

        reorderMarkers: function(editor) {
            editor.fire('lockSnapshot');
            var prefix  = editor.config.footnotesPrefix ? '-' + editor.config.footnotesPrefix : '';
            var $contents = $(editor.editable().$);
            var data = {
                order: [],
                occurrences: {}
            };

            // Check that there's a footnotes section. If it's been deleted the markers are useless:
            if ($contents.find('.footnotes').length == 0) {
                $contents.find('sup[data-footnote-id]').remove();
                editor.fire('unlockSnapshot');
                return;
            }

            // Find all the markers in the document:
            var $markers = $contents.find('sup[data-footnote-id]');
            // If there aren't any, remove the Footnotes container:
            if ($markers.length == 0) {
                $contents.find('.footnotes').parent().remove();
                editor.fire('unlockSnapshot');
                return;
            }

            // Otherwise reorder the markers:
            $markers.each(function(){
                var footnote_id = $(this).attr('data-footnote-id')
                  , marker_ref
                  , n = data.order.indexOf(footnote_id);

                // If this is the markers first occurrence:
                if (n == -1) {
                    // Store the id:
                    data.order.push(footnote_id);
                    n = data.order.length;
                    data.occurrences[footnote_id] = 1;
                    marker_ref = n + '-1';
                } else {
                    // Otherwise increment the number of occurrences:
                    // (increment n due to zero-index array)
                    n++;
                    data.occurrences[footnote_id]++;
                    marker_ref = n + '-' + data.occurrences[footnote_id];
                }
                // Replace the marker contents:
                var marker = '<a href="#footnote' + prefix + '-' + n + '" id="footnote-marker' + prefix + '-' + marker_ref + '" rel="footnote">[' + n + ']</a>';
                $(this).html(marker);
            });

            // Prepare the footnotes_store object:
            editor.footnotes_store = {};

            // Then rebuild the Footnotes content to match marker order:
            var footnotes     = ''
              , footnote_text = ''
              , footnote_id
              , i = 0
              , l = data.order.length;
            for (i; i < l; i++) {
                footnote_id   = data.order[i];
                footnote_text = $contents.find('.footnotes [data-footnote-id=' + footnote_id + '] cite').html();
                // If the footnotes text can't be found in the editor, it may be in the tmp store
                // following a cut:
                if (!footnote_text) {
                    footnote_text = editor.footnotes_tmp[footnote_id];
                }
                footnotes += this.buildFootnote(footnote_id, footnote_text, data, editor);
                // Store the footnotes for later use (post cut/paste):
                editor.footnotes_store[footnote_id] = footnote_text;
            }

            // Insert the footnotes into the list:
            $contents.find('.footnotes ol').html(footnotes);

            // Next we need to reinstate the 'editable' properties of the footnotes.
            // (we have to do this individually due to Widgets 'fireOnce' for editable selectors)
            var el = $contents.find('.footnotes')
              , n
              , footnote_widget;
            // So first we need to find the right Widget instance:
            // (I hope there's a better way of doing this but I can't find one)
            for (i in editor.widgets.instances) {
                if (editor.widgets.instances[i].name == 'footnotes') {
                    footnote_widget = editor.widgets.instances[i];
                    break;
                }
            }
            // Then we `initEditable` each footnote, giving it a unique selector:
            for (i in data.order) {
                n = parseInt(i) + 1;
                footnote_widget.initEditable('footnote_' + n, {selector: '#footnote' + prefix + '-' + n +' cite', allowedContent: 'a[href]; cite[*](*); em strong span'});
            }

            editor.fire('unlockSnapshot');
        }
    });
}(window.jQuery));
